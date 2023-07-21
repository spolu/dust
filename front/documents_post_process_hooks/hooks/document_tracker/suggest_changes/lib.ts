import sgMail from "@sendgrid/mail";
import { Op } from "sequelize";

import {
  DocumentsPostProcessHookFilterParams,
  DocumentsPostProcessHookOnUpsertParams,
} from "@app/documents_post_process_hooks/hooks";
import {
  getDatasource,
  getDocumentDiff,
} from "@app/documents_post_process_hooks/hooks/lib/data_source_helpers";
import { CoreAPI } from "@app/lib/core_api";
import {
  DataSource,
  DocumentTrackerChangeSuggestion,
  TrackedDocument,
  User,
  Workspace,
} from "@app/lib/models";
import mainLogger from "@app/logger/logger";

import { callDocTrackerRetrievalAction } from "./actions/doc_tracker_retrieval";
import { callDocTrackerSuggestChangesAction } from "./actions/doc_tracker_suggest_changes";

const { RUN_DOCUMENT_TRACKER_FOR_WORKSPACE_IDS = "" } = process.env;
const { SENDGRID_API_KEY } = process.env;

const MINIMUM_POSITIVE_DIFF_LENGTH = 20;
const MAX_DIFF_TOKENS = 4000;
const TOTAL_TARGET_TOKENS = 6000;
const RETRIEVAL_MIN_SCORE = 0.75;

const logger = mainLogger.child({
  postProcessHook: "document_tracker_suggest_changes",
});

export async function shouldDocumentTrackerSuggestChangesRun({
  dataSourceName,
  workspaceId,
  documentId,
  dataSourceConnectorProvider,
  verb,
}: DocumentsPostProcessHookFilterParams): Promise<boolean> {
  if (verb !== "upsert") {
    logger.info(
      "document_tracker_suggest_changes post process hook should only run for upsert."
    );
    return false;
  }

  const localLogger = logger.child({
    workspaceId,
    dataSourceName,
    documentId,
  });
  localLogger.info(
    "Checking if document_tracker_suggest_changes post process hook should run."
  );

  const whitelistedWorkspaceIds =
    RUN_DOCUMENT_TRACKER_FOR_WORKSPACE_IDS.split(",");

  if (!whitelistedWorkspaceIds.includes(workspaceId)) {
    localLogger.info(
      "Workspace not whitelisted, document_tracker_suggest_changes post process hook should not run."
    );
    return false;
  }

  if (dataSourceConnectorProvider === "slack") {
    // kind of a hack, but we don't want to run this hook for slack non-thread docs
    if (!documentId.includes("-thread-")) {
      localLogger.info(
        "Slack Document is not a thread, document_tracker_suggest_changes post process hook should not run."
      );
      return false;
    }
  }

  const dataSource = await getDatasource(dataSourceName, workspaceId);

  const docIsTracked = !!(await TrackedDocument.count({
    where: {
      dataSourceId: dataSource.id,
      documentId,
    },
  }));

  if (docIsTracked) {
    // Never run document_tracker_suggest_changes for tracked documents.
    // Documents are either sources or targets, not both.
    // TODO: let's revisit this decision later.
    // TODO: should we also skip docs that have DUST_TRACK tags?
    localLogger.info(
      "Document is tracked, document_tracker_suggest_changes post process hook should not run."
    );
    return false;
  }

  const workspaceDataSourceIds = (
    await DataSource.findAll({
      where: { workspaceId: dataSource.workspaceId },
      attributes: ["id"],
    })
  ).map((ds) => ds.id);

  const hasTrackedDocuments = !!(await TrackedDocument.count({
    where: {
      dataSourceId: {
        [Op.in]: workspaceDataSourceIds,
      },
      documentId: {
        [Op.not]: documentId,
      },
    },
  }));

  if (hasTrackedDocuments) {
    localLogger.info(
      "Workspace has tracked documents, document_tracker_suggest_changes post process hook should run."
    );
    return true;
  }

  localLogger.info(
    "Workspace has no tracked documents, document_tracker_suggest_changes post process hook should not run."
  );

  return false;
}

export async function documentTrackerSuggestChangesOnUpsert({
  dataSourceName,
  workspaceId,
  documentId,
  documentHash,
  documentSourceUrl,
}: DocumentsPostProcessHookOnUpsertParams): Promise<void> {
  const localLogger = logger.child({
    workspaceId,
    dataSourceName,
    documentId,
    documentHash,
  });

  localLogger.info(
    "Running document_tracker_suggest_changes post upsert hook."
  );

  const workspace = await Workspace.findOne({
    where: { sId: workspaceId },
  });
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const dataSource = await getDatasource(dataSourceName, workspaceId);
  const isDocTracked = !!(await TrackedDocument.count({
    where: {
      dataSourceId: dataSource.id,
      documentId,
    },
  }));
  // TODO: see how we want to support this. Obviously the action in the current form will
  // just match the document that was just upserted if it's tracked.
  // We check this in the filter, but there could be a race condition.
  if (isDocTracked) {
    localLogger.info("Document is tracked: not searching for matches.");
    return;
  }
  const documentDiff = await getDocumentDiff({
    dataSourceName: dataSource.name,
    workspaceId,
    documentId,
    hash: documentHash,
  });

  const positiveDiff = documentDiff
    .filter(({ type }) => type === "insert")
    .map(({ value }) => value)
    .join("");
  if (positiveDiff.length < MINIMUM_POSITIVE_DIFF_LENGTH) {
    localLogger.info(
      {
        positiveDiffLength: positiveDiff.length,
      },
      "Positive diff is too short, not searching for matches."
    );

    return;
  }

  const diffText = documentDiff
    .filter(({ type }) => type !== "equal")
    .map(({ value, type }) => `[[**${type}**:\n${value}]]`)
    .join("\n");

  const tokensInDiff = await CoreAPI.tokenize({
    text: diffText,
    modelId: "text-embedding-ada-002",
    providerId: "openai",
  });
  if (tokensInDiff.isErr()) {
    throw tokensInDiff.error;
  }

  const tokensInDiffCount = tokensInDiff.value.tokens.length;
  if (tokensInDiffCount > MAX_DIFF_TOKENS) {
    localLogger.info(
      { tokensInDiffCount, positiveDiffLength: positiveDiff.length },
      "Diff is too long, not searching for matches."
    );
    return;
  }

  const targetDocumentTokens = TOTAL_TARGET_TOKENS - tokensInDiffCount;

  localLogger.info(
    {
      positiveDiffLength: positiveDiff.length,
      tokensInDiffCount,
    },
    "Calling doc tracker retrieval action."
  );
  const retrievalResult = await callDocTrackerRetrievalAction(
    workspaceId,
    diffText,
    targetDocumentTokens
  );

  if (!retrievalResult.length) {
    localLogger.warn("No documents found.");
    return;
  }
  // TODO: maybe not just look at top1, look at top 3 chunks and do on multiple docs if needed
  const top1 = retrievalResult[0];
  const score = top1.chunks[0].score;

  if (score < RETRIEVAL_MIN_SCORE) {
    localLogger.info(
      { score },
      "Score is too low, not calling doc tracker suggest changes action."
    );
    return;
  }

  localLogger.info({ score }, "Calling doc tracker suggest changes action.");

  const suggestChangesResult = await callDocTrackerSuggestChangesAction(
    workspaceId,
    diffText,
    top1.chunks.map((c) => c.text).join("\n-------\n")
  );

  if (!suggestChangesResult.match) {
    localLogger.info({ score }, "No match found.");
    return;
  }

  const suggestedChanges = suggestChangesResult.suggested_changes;
  const matchedDsName = top1.data_source_id;
  const matchedDocId = top1.document_id;
  const matchedDocUrl = top1.source_url;
  const matchedDocTags = top1.tags;
  const maybeMatchedDocTitleTag = matchedDocTags.find((t) =>
    t.startsWith("title:")
  );
  const matchedDocTitle = maybeMatchedDocTitleTag
    ? maybeMatchedDocTitleTag.split(":")[1]
    : null;

  localLogger.info(
    {
      matchedDsName,
      matchedDocId,
      matchedDocUrl,
      matchedDocTitle,
      score,
    },
    "Match found."
  );

  const matchedDs = await DataSource.findOne({
    where: {
      name: matchedDsName,
      workspaceId: workspace.id,
    },
  });
  if (!matchedDs) {
    throw new Error(
      `Could not find data source with name ${matchedDsName} and workspaceId ${workspaceId}`
    );
  }

  // again, checking for race condition here and skipping if the
  // matched doc is the doc that was just upserted.
  if (matchedDs.id === dataSource.id && matchedDocId === documentId) {
    localLogger.info(
      {
        matchedDsName,
        matchedDocId,
      },
      "Matched document is the document that was just upserted."
    );
    return;
  }

  const trackedDocuments = await TrackedDocument.findAll({
    where: {
      documentId: matchedDocId,
      dataSourceId: matchedDs.id,
    },
  });
  if (!trackedDocuments.length) {
    localLogger.warn(
      {
        matchedDsName,
        matchedDocId,
      },
      "Could not find tracked documents for matched document."
    );
    return;
  }

  logger.info(
    {
      matchedDsName,
      matchedDocId,
    },
    "Creating change suggestions in database."
  );
  await Promise.all(
    trackedDocuments.map((td) =>
      DocumentTrackerChangeSuggestion.create({
        trackedDocumentId: td.id,
        sourceDataSourceId: dataSource.id,
        sourceDocumentId: documentId,
        suggestion: suggestedChanges,
        status: "pending",
      })
    )
  );

  const users = await User.findAll({
    where: {
      id: {
        [Op.in]: trackedDocuments.map((td) => td.userId),
      },
    },
  });
  const emails = users.map((u) => u.email);
  if (!SENDGRID_API_KEY) {
    throw new Error("Missing SENDGRID_API_KEY env variable");
  }
  sgMail.setApiKey(SENDGRID_API_KEY);
  const incomingDocument = await CoreAPI.getDataSourceDocument({
    projectId: dataSource.dustAPIProjectId,
    dataSourceName: dataSource.name,
    documentId,
  });
  if (incomingDocument.isErr()) {
    throw new Error(
      `Could not get document ${documentId} from data source ${dataSource.name}`
    );
  }

  const incomingDocumentTags = incomingDocument.value.document.tags;
  const maybeIncomingDocumentTitleTag = incomingDocumentTags.find((t) =>
    t.startsWith("title:")
  );
  const incomingDocumentTitle = maybeIncomingDocumentTitleTag;

  const sendEmail = async (email: string) => {
    localLogger.info(
      {
        matchedDsName,
        matchedDocId,
        email,
      },
      "Sending email to user."
    );
    const msg = {
      to: email,
      from: "team@dust.tt",
      subject: `DUST: Document update suggestion for ${
        matchedDocTitle || matchedDocUrl
      }`,
      html: `Hello!<br>
  We have a suggestion for you to update the document <a href="${matchedDocUrl}">${
        matchedDocTitle || matchedDocUrl
      }</a>, based on the new document <a href="${documentSourceUrl}">${
        incomingDocumentTitle || documentSourceUrl
      }</a>:<br>
  ${suggestedChanges}<br>
  The Dust team`,
    };
    await sgMail.send(msg);
  };
  await Promise.all(emails.map(sendEmail));
}
