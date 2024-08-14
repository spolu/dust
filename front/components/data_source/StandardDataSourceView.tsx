import {
  Button,
  ContextItem,
  Dialog,
  DocumentTextIcon,
  Page,
  PencilSquareIcon,
  PlusIcon,
  Popup,
  ServerIcon,
  Tab,
} from "@dust-tt/sparkle";
import type {
  CoreAPIDocument,
  DataSourceType,
  PlanType,
  WorkspaceType,
} from "@dust-tt/types";
import type { PostDataSourceDocumentRequestBody } from "@dust-tt/types";
import { Err, Ok } from "@dust-tt/types";
import { useRouter } from "next/router";
import { useContext, useEffect, useMemo, useRef, useState } from "react";

import { DocumentUploadModal } from "@app/components/data_source/DocumentUploadModal";
import { SendNotificationsContext } from "@app/components/sparkle/Notification";
import { handleFileUploadToText } from "@app/lib/client/handle_file_upload";
import { tableKey } from "@app/lib/client/tables_query";
import { getDisplayNameForDocument } from "@app/lib/data_sources";
import { useDocuments, useTables } from "@app/lib/swr";
import { ClientSideTracking } from "@app/lib/tracking/client";
import { timeAgoFrom } from "@app/lib/utils";

const tabIds = ["documents", "tables"];

function DatasourceDocumentsTabView({
  owner,
  plan,
  readOnly,
  dataSource,
  router,
}: {
  owner: WorkspaceType;
  plan: PlanType;
  readOnly: boolean;
  dataSource: DataSourceType;
  router: ReturnType<typeof useRouter>;
}) {
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);

  const {
    documents,
    total,
    isDocumentsLoading,
    isDocumentsError,
    mutateDocuments,
  } = useDocuments(owner, dataSource, limit, offset);
  const [showDocumentsLimitPopup, setShowDocumentsLimitPopup] = useState(false);
  const [showDataSourceUploadModal, setShowDataSourceUploadModal] =
    useState(false);
  const [displayNameByDocId, setDisplayNameByDocId] = useState<
    Record<string, string>
  >({});
  const [documentToLoad, setDocumentToLoad] = useState<CoreAPIDocument | null>(
    null
  );
  const sendNotification = useContext(SendNotificationsContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bulkFilesUploading, setBulkFilesUploading] = useState<null | {
    total: number;
    completed: number;
  }>(null);

  const handleUpsert = async (text: string, documentId: string) => {
    const body: PostDataSourceDocumentRequestBody = {
      timestamp: null,
      parents: null,
      section: {
        prefix: null,
        content: text,
        sections: [],
      },
      text: null,
      source_url: undefined,
      tags: [],
      light_document_output: true,
      upsert_context: null,
      async: false,
    };

    try {
      const res = await fetch(
        `/api/w/${owner.sId}/data_sources/${
          dataSource.name
        }/documents/${encodeURIComponent(documentId)}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        let errMsg = "";
        try {
          const data = await res.json();
          errMsg = data.error.message;
        } catch (e) {
          errMsg = "An error occurred while uploading your document.";
        }
        return new Err(errMsg);
      }
    } catch (e) {
      return new Err("An error occurred while uploading your document.");
    }

    return new Ok(null);
  };

  useEffect(() => {
    if (!isDocumentsLoading && !isDocumentsError) {
      setDisplayNameByDocId(
        documents.reduce(
          (acc, doc) =>
            Object.assign(acc, {
              [doc.document_id]: getDisplayNameForDocument(doc),
            }),
          {}
        )
      );
    }
    if (isDocumentsError) {
      setDisplayNameByDocId({});
    }
  }, [documents, isDocumentsLoading, isDocumentsError]);

  let last = offset + limit;
  if (offset + limit > total) {
    last = total;
  }

  return (
    <Page.Vertical align="stretch">
      <div className="mt-16 flex flex-row">
        <div className="flex flex-1">
          <div className="flex flex-col">
            <div className="flex flex-row">
              <div className="flex flex-initial gap-x-2">
                <Button
                  variant="tertiary"
                  disabled={offset < limit}
                  onClick={() => {
                    if (offset >= limit) {
                      setOffset(offset - limit);
                    } else {
                      setOffset(0);
                    }
                  }}
                  label="Previous"
                />
                <Button
                  variant="tertiary"
                  label="Next"
                  disabled={offset + limit >= total}
                  onClick={() => {
                    if (offset + limit < total) {
                      setOffset(offset + limit);
                    }
                  }}
                />
              </div>
            </div>

            <div className="mt-3 flex flex-auto pl-2 text-sm text-gray-700">
              {total > 0 && (
                <span>
                  Showing documents {offset + 1} - {last} of {total} documents
                </span>
              )}
            </div>
          </div>
        </div>

        {readOnly ? null : (
          <div className="">
            <div className="relative mt-0 flex-none">
              <Popup
                show={showDocumentsLimitPopup}
                chipLabel={`${plan.name} plan`}
                description={`You have reached the limit of documents per data source (${plan.limits.dataSources.documents.count} documents). Upgrade your plan for unlimited documents and data sources.`}
                buttonLabel="Check Dust plans"
                buttonClick={() => {
                  void router.push(`/w/${owner.sId}/subscription`);
                }}
                onClose={() => {
                  setShowDocumentsLimitPopup(false);
                }}
                className="absolute bottom-8 right-0"
              />

              <>
                <Dialog
                  onCancel={() => {
                    //no-op as we can't cancel file upload
                  }}
                  onValidate={() => {
                    //no-op as we can't cancel file upload
                  }}
                  // isSaving is always true since we are showing this Dialog while
                  // uploading files only
                  isSaving={true}
                  isOpen={bulkFilesUploading !== null}
                  title={`Uploading files`}
                >
                  {bulkFilesUploading && (
                    <>
                      Processing files {bulkFilesUploading.completed} /{" "}
                      {bulkFilesUploading.total}
                    </>
                  )}
                </Dialog>
                <input
                  className="hidden"
                  type="file"
                  accept=".txt, .pdf, .md, .csv"
                  ref={fileInputRef}
                  multiple={true}
                  onChange={async (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      const files = e.target.files;
                      ClientSideTracking.trackMultiFilesUploadUsed({
                        fileCount: files.length,
                        workspaceId: owner.sId,
                      });
                      let i = 0;
                      for (const file of files) {
                        setBulkFilesUploading({
                          total: files.length,
                          completed: i++,
                        });
                        try {
                          const uploadRes = await handleFileUploadToText(file);
                          if (uploadRes.isErr()) {
                            sendNotification({
                              type: "error",
                              title: `Error uploading document ${file.name}`,
                              description: uploadRes.error.message,
                            });
                          } else {
                            const upsertRes = await handleUpsert(
                              uploadRes.value.content,
                              file.name
                            );
                            if (upsertRes.isErr()) {
                              sendNotification({
                                type: "error",
                                title: `Error uploading document ${file.name}`,
                                description: upsertRes.error,
                              });
                            }
                          }
                        } catch (e) {
                          sendNotification({
                            type: "error",
                            title: "Error uploading document",
                            description: `An error occurred while uploading your documents.`,
                          });
                        }
                      }
                      setBulkFilesUploading(null);
                      await mutateDocuments();
                    }
                  }}
                ></input>

                <Button
                  className="mr-2"
                  variant="secondary"
                  icon={PlusIcon}
                  label="Upload multiples files"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                />
              </>

              <Button
                variant="primary"
                icon={PlusIcon}
                label="Add document"
                onClick={() => {
                  // Enforce plan limits: DataSource documents count.
                  if (
                    plan.limits.dataSources.documents.count != -1 &&
                    total >= plan.limits.dataSources.documents.count
                  ) {
                    setShowDocumentsLimitPopup(true);
                  } else {
                    setShowDataSourceUploadModal(true);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="py-8">
        <ContextItem.List>
          {documents.map((d) => (
            <ContextItem
              key={d.document_id}
              title={displayNameByDocId[d.document_id]}
              visual={
                <ContextItem.Visual
                  visual={({ className }) =>
                    DocumentTextIcon({
                      className: className + " text-element-600",
                    })
                  }
                />
              }
              action={
                <Button.List>
                  <Button
                    variant="secondary"
                    icon={PencilSquareIcon}
                    onClick={() => {
                      setDocumentToLoad(d);
                      setShowDataSourceUploadModal(true);
                    }}
                    label="Edit"
                    labelVisible={false}
                  />
                </Button.List>
              }
            >
              <ContextItem.Description>
                <div className="pt-2 text-sm text-element-700">
                  {Math.floor(d.text_size / 1024)} kb,{" "}
                  {timeAgoFrom(d.timestamp)} ago
                </div>
              </ContextItem.Description>
            </ContextItem>
          ))}
        </ContextItem.List>
        {documents.length == 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center text-sm text-gray-500">
            <p>No documents found for this Folder.</p>
            <p className="mt-2">You can add documents manually or by API.</p>
          </div>
        ) : null}
      </div>
      <DocumentUploadModal
        isOpen={showDataSourceUploadModal}
        onClose={() => setShowDataSourceUploadModal(false)}
        owner={owner}
        dataSource={dataSource}
        plan={plan}
        documentToLoad={documentToLoad}
      />
    </Page.Vertical>
  );
}

function DatasourceTablesTabView({
  owner,
  readOnly,
  dataSource,
  router,
}: {
  owner: WorkspaceType;
  readOnly: boolean;
  dataSource: DataSourceType;
  router: ReturnType<typeof useRouter>;
}) {
  const { tables } = useTables({
    workspaceId: owner.sId,
    dataSourceName: dataSource.name,
  });

  return (
    <>
      <Page.Vertical align="stretch">
        <div className="mt-16 flex flex-row">
          <div className="flex flex-1">
            <div className="flex flex-col">
              <div className="flex flex-row">
                <div className="flex flex-initial gap-x-2">
                  <Button variant="tertiary" disabled={true} label="Previous" />
                  <Button variant="tertiary" label="Next" disabled={true} />
                </div>
              </div>
            </div>
          </div>
          {readOnly ? null : (
            <div className="">
              <div className="relative mt-0 flex-none">
                <Button
                  variant="primary"
                  icon={PlusIcon}
                  label="Add table"
                  onClick={() => {
                    void router.push(
                      `/w/${owner.sId}/builder/data-sources/${dataSource.name}/tables/upsert`
                    );
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="py-8">
          <ContextItem.List>
            {tables.map((t) => (
              <ContextItem
                key={tableKey({
                  workspaceId: owner.sId,
                  tableId: t.table_id,
                  dataSourceId: dataSource.name,
                })}
                title={`${t.name} (${t.data_source_id})`}
                visual={
                  <ContextItem.Visual
                    visual={({ className }) =>
                      ServerIcon({
                        className: className + " text-element-600",
                      })
                    }
                  />
                }
                action={
                  <Button.List>
                    <Button
                      variant="secondary"
                      icon={PencilSquareIcon}
                      onClick={() => {
                        void router.push(
                          `/w/${owner.sId}/builder/data-sources/${
                            dataSource.name
                          }/tables/upsert?tableId=${encodeURIComponent(
                            t.table_id
                          )}`
                        );
                      }}
                      label="Edit"
                      labelVisible={false}
                    />
                  </Button.List>
                }
              ></ContextItem>
            ))}
          </ContextItem.List>
          {tables.length == 0 ? (
            <div className="mt-10 flex flex-col items-center justify-center text-sm text-gray-500">
              <p>No tables found for this Folder.</p>
              <p className="mt-2">
                Tables let you create assistants that can query structured data
                from uploaded CSV files. You can add tables manually by clicking
                on the &quot;Add&nbsp;table&quot; button.
              </p>
            </div>
          ) : null}
        </div>
      </Page.Vertical>
    </>
  );
}

export function StandardDataSourceView({
  owner,
  plan,
  readOnly,
  dataSource,
}: {
  owner: WorkspaceType;
  plan: PlanType;
  readOnly: boolean;
  dataSource: DataSourceType;
}) {
  const router = useRouter();

  type TabId = (typeof tabIds)[number];
  const [currentTab, setCurrentTab] = useState<TabId>("documents");
  const tabs = useMemo(
    () =>
      tabIds.map((tabId) => ({
        label: tabId.charAt(0).toUpperCase() + tabId.slice(1),
        id: tabId,
        current: currentTab === tabId,
      })),
    [currentTab]
  );

  useEffect(() => {
    if (router.query.tab === "tables") {
      setCurrentTab("tables");
      const newQuery = { ...router.query };
      delete newQuery.tab;
      void router.replace(
        {
          pathname: router.pathname,
          query: newQuery,
        },
        undefined,
        { shallow: true } // no reload
      );
    }
  }, [router]);

  return (
    <div className="pt-6">
      <Page.Vertical gap="xl" align="stretch">
        <Page.SectionHeader
          title={dataSource.name}
          description={
            "Use this page to view and upload documents and tables to your Folder."
          }
        />

        <Tab tabs={tabs} setCurrentTab={setCurrentTab} />

        {currentTab === "documents" && (
          <DatasourceDocumentsTabView
            owner={owner}
            plan={plan}
            readOnly={readOnly}
            dataSource={dataSource}
            router={router}
          />
        )}
        {currentTab === "tables" && (
          <DatasourceTablesTabView
            owner={owner}
            readOnly={readOnly}
            dataSource={dataSource}
            router={router}
          />
        )}
      </Page.Vertical>
    </div>
  );
}
