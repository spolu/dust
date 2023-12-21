import {
  ArrowUpIcon,
  AttachmentIcon,
  Avatar,
  Button,
  Citation,
  FullscreenExitIcon,
  FullscreenIcon,
  IconButton,
  StopIcon,
} from "@dust-tt/sparkle";
import { WorkspaceType } from "@dust-tt/types";
import { AgentConfigurationType } from "@dust-tt/types";
import { AgentMention, MentionType } from "@dust-tt/types";
import { Transition } from "@headlessui/react";
import {
  createContext,
  ForwardedRef,
  forwardRef,
  Fragment,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as ReactDOMServer from "react-dom/server";
import { mutate } from "swr";

import { GenerationContext } from "@app/components/assistant/conversation/GenerationContextProvider";
import { SendNotificationsContext } from "@app/components/sparkle/Notification";
import { compareAgentsForSort } from "@app/lib/assistant";
import { handleFileUploadToText } from "@app/lib/client/handle_file_upload";
import { useAgentConfigurations } from "@app/lib/swr";
import { classNames, filterAndSortAgents } from "@app/lib/utils";

import InputBarContainer from "./InputBarTipTap";

// AGENT MENTION

function AgentMention({
  agentConfiguration,
}: {
  agentConfiguration: AgentConfigurationType;
}) {
  return (
    <div
      className={classNames("inline-block font-medium text-brand")}
      contentEditable={false}
      data-agent-configuration-id={agentConfiguration?.sId}
      data-agent-name={agentConfiguration?.name}
    >
      @{agentConfiguration.name}
    </div>
  );
}

// AGENT LIST

export function AssistantInputBar({
  owner,
  onSubmit,
  conversationId,
  stickyMentions,
}: {
  owner: WorkspaceType;
  onSubmit: (
    input: string,
    mentions: MentionType[],
    contentFragment?: { title: string; content: string }
  ) => void;
  conversationId: string | null;
  stickyMentions?: AgentMention[];
}) {
  const [contentFragmentBody, setContentFragmentBody] = useState<
    string | undefined
  >(undefined);
  const [contentFragmentFilename, setContentFragmentFilename] = useState<
    string | undefined
  >(undefined);
  const { agentConfigurations } = useAgentConfigurations({
    workspaceId: owner.sId,
    agentsGetView: conversationId ? { conversationId } : "list",
  });
  const sendNotification = useContext(SendNotificationsContext);

  const activeAgents = agentConfigurations.filter((a) => a.status === "active");
  activeAgents.sort(compareAgentsForSort);

  // const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (jsonPayload, resetEditorText) => {
    // TODO: Only display in blue the CTA once the editor is not empty.
    // if (empty) {
    //   return;
    // }

    console.log(">>jsonPayload:", JSON.stringify(jsonPayload, null, 2));

    const mentions: MentionType[] = [];
    let content = "";

    const [firstParagraph] = jsonPayload.content;

    for (const node of firstParagraph.content) {
      if (node.type === "mention") {
        const { id: agentConfigurationId, label: agentName } = node.attrs;
        if (agentConfigurationId && agentName) {
          mentions.push({
            configurationId: agentConfigurationId,
          });
          // Internal format for mentions is `:mention[agentName]{sId=agentConfigurationId}`.
          content += `:mention[${agentName}]{sId=${agentConfigurationId}}`;
        }
      }
      if (node.type === "text") {
        content += node.text;
      }
    }

    console.log(">> content:", content);

    content = content.trim();
    // Still needed?
    content = content.replace(/\u200B/g, "");
    let contentFragment:
      | {
          title: string;
          content: string;
          url: string | null;
          contentType: string;
        }
      | undefined = undefined;
    if (contentFragmentBody && contentFragmentFilename) {
      contentFragment = {
        title: contentFragmentFilename,
        content: contentFragmentBody,
        url: null,
        contentType: "file_attachment",
      };
    }
    // setIsExpanded(false);
    onSubmit(content, mentions, contentFragment);
    resetEditorText();
    setContentFragmentFilename(undefined);
    setContentFragmentBody(undefined);
  };

  const onInputFileChange = async (event) => {
    const file = event?.target?.files?.[0];
    console.log("> file:", file);
    if (!file) return;
    if (file.size > 10_000_000) {
      sendNotification({
        type: "error",
        title: "File too large.",
        description:
          "PDF uploads are limited to 10Mb per file. Please consider uploading a smaller file.",
      });
      return;
    }
    const res = await handleFileUploadToText(file);

    if (res.isErr()) {
      sendNotification({
        type: "error",
        title: "Error uploading file.",
        description: res.error.message,
      });
      return;
    }
    if (res.value.content.length > 1_000_000) {
      // This error should pretty much never be triggered but it is a possible case, so here it is.
      sendNotification({
        type: "error",
        title: "File too large.",
        description:
          "The extracted text from your PDF has more than 1 million characters. This will overflow the assistant context. Please consider uploading a smaller file.",
      });
      return;
    }

    setContentFragmentFilename(res.value.title);
    setContentFragmentBody(res.value.content);
  };

  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const { animate, selectedAssistant } = useContext(InputBarContext);

  useEffect(() => {
    if (animate && !isAnimating) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 1500);
    }
  }, [animate, isAnimating]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // GenerationContext: to know if we are generating or not
  const generationContext = useContext(GenerationContext);
  if (!generationContext) {
    throw new Error(
      "FixedAssistantInputBar must be used within a GenerationContextProvider"
    );
  }

  const handleStopGeneration = async () => {
    if (!conversationId) {
      return;
    }
    setIsProcessing(true); // we don't set it back to false immediately cause it takes a bit of time to cancel
    await fetch(
      `/api/w/${owner.sId}/assistant/conversations/${conversationId}/cancel`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "cancel",
          messageIds: generationContext.generatingMessageIds,
        }),
      }
    );
    await mutate(
      `/api/w/${owner.sId}/assistant/conversations/${conversationId}`
    );
  };

  useEffect(() => {
    if (isProcessing && generationContext.generatingMessageIds.length === 0) {
      setIsProcessing(false);
    }
  }, [isProcessing, generationContext.generatingMessageIds.length]);

  console.log("> isAnimating:", isAnimating);

  console.log(">> contentFragmentFilename:", contentFragmentFilename);
  console.log(">> contentFragmentBody:", contentFragmentBody);

  return (
    <>
      {/* <AgentList
        owner={owner}
        visible={agentListVisible}
        filter={agentListFilter}
        ref={agentListRef}
        position={agentListPosition}
        conversationId={conversationId}
      /> */}

      {generationContext.generatingMessageIds.length > 0 && (
        <div className="flex justify-center px-4 pb-4">
          <Button
            className="mt-4"
            variant="tertiary"
            label={isProcessing ? "Stopping generation..." : "Stop generation"}
            icon={StopIcon}
            onClick={handleStopGeneration}
            disabled={isProcessing}
          />
        </div>
      )}

      <div className="flex flex-1 px-0 sm:px-4">
        <div className="flex w-full flex-1 flex-col items-end self-stretch sm:flex-row">
          <div
            className={classNames(
              "relative flex w-full flex-1 flex-col items-stretch gap-0 self-stretch pl-4 sm:flex-row",
              "border-struture-200 border-t bg-white/80 shadow-[0_0_36px_-15px_rgba(0,0,0,0.3)] backdrop-blur focus-within:border-structure-300 sm:rounded-3xl sm:border-2 sm:border-element-500 sm:shadow-[0_12px_36px_-15px_rgba(0,0,0,0.3)] sm:focus-within:border-element-600",
              "transition-all duration-300",
              isAnimating
                ? "animate-shake border-action-500 focus-within:border-action-800"
                : ""
            )}
          >
            <div className="relative flex w-full flex-1 flex-col">
              {contentFragmentFilename && contentFragmentBody && (
                <div className="border-b border-structure-300/50 pb-3 pt-5">
                  <Citation
                    title={contentFragmentFilename}
                    description={contentFragmentBody?.substring(0, 100)}
                    onClose={() => {
                      setContentFragmentBody(undefined);
                      setContentFragmentFilename(undefined);
                    }}
                  />
                </div>
              )}

              <InputBarContainer
                allMentions={activeAgents}
                agentConfigurations={agentConfigurations}
                owner={owner}
                conversationId={conversationId}
                selectedAssistant={selectedAssistant}
                onEnterKeyDown={handleSubmit}
                stickyMentions={stickyMentions}
                onInputFileChange={onInputFileChange}
                disableAttachment={!!contentFragmentFilename}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function FixedAssistantInputBar({
  owner,
  onSubmit,
  stickyMentions,
  conversationId,
}: {
  owner: WorkspaceType;
  onSubmit: (
    input: string,
    mentions: MentionType[],
    contentFragment?: { title: string; content: string }
  ) => void;
  stickyMentions?: AgentMention[];
  conversationId: string | null;
}) {
  return (
    <div className="4xl:px-0 fixed bottom-0 left-0 right-0 z-20 flex-initial lg:left-80">
      <div className="mx-auto max-h-screen max-w-4xl pb-0 sm:pb-8">
        <AssistantInputBar
          owner={owner}
          onSubmit={onSubmit}
          conversationId={conversationId}
          stickyMentions={stickyMentions}
        />
      </div>
    </div>
  );
}

export const InputBarContext = createContext<{
  animate: boolean;
  selectedAssistant: AgentMention | null;
}>({
  animate: false,
  selectedAssistant: null,
});
