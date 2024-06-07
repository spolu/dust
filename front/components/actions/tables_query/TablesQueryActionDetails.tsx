import { Citation, Collapsible, TableIcon } from "@dust-tt/sparkle";
import type { TablesQueryActionType } from "@dust-tt/types";
import { stringify } from "csv-stringify";
import { useCallback, useContext } from "react";

import { ActionDetailsWrapper } from "@app/components/actions/ActionDetailsWrapper";
import type { ActionDetailsComponentBaseProps } from "@app/components/actions/types";
import { CodeBlock } from "@app/components/assistant/RenderMessageMarkdown";
import { ClipboardBanner } from "@app/components/misc/ClipboardBanner";
import { SendNotificationsContext } from "@app/components/sparkle/Notification";

export function TablesQueryActionDetails({
  action,
  defaultOpen,
}: ActionDetailsComponentBaseProps<TablesQueryActionType>) {
  return (
    <ActionDetailsWrapper
      actionName="Query tables"
      defaultOpen={defaultOpen}
      visual={TableIcon}
    >
      <div className="flex flex-col gap-1 gap-4 pl-6 pt-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-slate-900">Query</span>
          <div className="text-sm font-normal text-slate-500">
            <TablesQuery action={action} />
          </div>
        </div>
        <div>
          <Collapsible defaultOpen={defaultOpen}>
            <Collapsible.Button>
              <span className="text-sm font-bold text-slate-900">Results</span>
            </Collapsible.Button>
            <Collapsible.Panel>
              <QueryTablesResults action={action} />
            </Collapsible.Panel>
          </Collapsible>
        </div>
      </div>
    </ActionDetailsWrapper>
  );
}

function TablesQuery({ action }: { action: TablesQueryActionType }) {
  const { output } = action;
  const query = typeof output?.query === "string" ? output.query : null;
  const noQuery = output?.no_query === true;

  if (noQuery || !query) {
    return null;
  }

  return (
    <ClipboardBanner content={query}>
      <CodeBlock className="language-sql" wrapLongLines={true}>
        {query}
      </CodeBlock>
    </ClipboardBanner>
  );
}

type TablesQueryActionWithResultsType = TablesQueryActionType & {
  output: {
    query_title?: string;
    results: unknown[];
  };
};

function hasQueryResults(
  action: TablesQueryActionType
): action is TablesQueryActionWithResultsType {
  const { output } = action;

  return (
    output !== null &&
    typeof output === "object" &&
    "results" in output &&
    Array.isArray(output.results)
  );
}

function QueryTablesResults({ action }: { action: TablesQueryActionType }) {
  const sendNotification = useContext(SendNotificationsContext);

  if (!hasQueryResults(action)) {
    return null;
  }

  const { output } = action;
  const title = output.query_title ?? "query_results";

  const handleDownload = useCallback(() => {
    if (output.results.length === 0) {
      return;
    }

    stringify(output.results, { header: true }, (err, csvOutput) => {
      if (err) {
        sendNotification({
          title: "Error Downloading CSV",
          type: "error",
          description: `An error occurred while downloading the CSV: ${err}`,
        });
        return;
      }

      const blob = new Blob([csvOutput], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.csv`;
      a.click();
    });
  }, [output.results, title, sendNotification]);

  return (
    <div onClick={handleDownload}>
      <Citation size="xs" title={title} />
    </div>
  );
}
