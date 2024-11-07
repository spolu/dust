import {
  ArrowUpIcon,
  Button,
  CheckCircleIcon,
  StopSignIcon,
} from "@dust-tt/sparkle";
import type {
  AgentMention,
  LightAgentConfigurationType,
  LightWorkspaceType,
} from "@dust-tt/types";
import { AssistantPicker } from "@extension/components/assistants/AssistantPicker";
import { AttachFragment } from "@extension/components/conversation/AttachFragment";
import type { CustomEditorProps } from "@extension/components/input_bar/editor/useCustomEditor";
import useCustomEditor from "@extension/components/input_bar/editor/useCustomEditor";
import useHandleMentions from "@extension/components/input_bar/editor/useHandleMentions";
import { usePublicAssistantSuggestions } from "@extension/components/input_bar/editor/usePublicAssistantSuggestions";
import { InputBarContext } from "@extension/components/input_bar/InputBarContext";
import type { FileUploaderService } from "@extension/hooks/useFileUploaderService";
import { classNames } from "@extension/lib/utils";
import { EditorContent } from "@tiptap/react";
import React, { useContext, useEffect } from "react";

export interface InputBarContainerProps {
  allAssistants: LightAgentConfigurationType[];
  agentConfigurations: LightAgentConfigurationType[];
  onEnterKeyDown: CustomEditorProps["onEnterKeyDown"];
  owner: LightWorkspaceType;
  selectedAssistant: AgentMention | null;
  stickyMentions?: AgentMention[];
  disableAutoFocus: boolean;
  isTabIncluded: boolean;
  toggleIncludeTab: () => void;
  fileUploaderService: FileUploaderService;
}

export const InputBarContainer = ({
  allAssistants,
  agentConfigurations,
  onEnterKeyDown,
  owner,
  selectedAssistant,
  stickyMentions,
  disableAutoFocus,
  isTabIncluded,
  toggleIncludeTab,
  fileUploaderService,
}: InputBarContainerProps) => {
  const suggestions = usePublicAssistantSuggestions(agentConfigurations);

  // Pulsing animation for the include tab button
  const [isPulsingActive, setIsPulsingActive] = React.useState(true);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPulsingActive(false);
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  const { editor, editorService } = useCustomEditor({
    suggestions,
    onEnterKeyDown,
    disableAutoFocus,
  });

  // When input bar animation is requested it means the new button was clicked (removing focus from
  // the input bar), we grab it back.
  const { animate } = useContext(InputBarContext);
  useEffect(() => {
    if (animate) {
      editorService.focusEnd();
    }
  }, [animate, editorService]);

  useHandleMentions(
    editorService,
    agentConfigurations,
    stickyMentions,
    selectedAssistant,
    disableAutoFocus
  );

  const contentEditableClasses = classNames(
    "inline-block w-full",
    "border-0 pr-1 pl-2 sm:pl-0 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 py-3.5",
    "whitespace-pre-wrap font-normal"
  );

  return (
    <div
      id="InputBarContainer"
      className="relative flex flex-1 flex-col sm:flex-row"
    >
      <EditorContent
        editor={editor}
        className={classNames(
          contentEditableClasses,
          "scrollbar-hide",
          "overflow-y-auto",
          "max-h-64"
        )}
      />

      <div className="flex flex-row items-end justify-between gap-2 self-stretch pb-2 pr-2 sm:flex-col sm:border-0">
        <div className="flex py-2 space-x-1">
          <Button
            icon={isTabIncluded ? CheckCircleIcon : StopSignIcon}
            label={isTabIncluded ? "Tab sharing ON" : "Tab sharing OFF"}
            tooltip={
              isTabIncluded
                ? "Each message in this conversation includes the content of the current tab as attachment."
                : "If enabled, each message in this conversation will include the content of the current tab as attachment."
            }
            variant="outline"
            size="xs"
            isPulsing={isPulsingActive}
            onClick={toggleIncludeTab}
          />
          <AssistantPicker
            owner={owner}
            size="xs"
            onItemClick={(c) => {
              editorService.insertMention({ id: c.sId, label: c.name });
            }}
            assistants={allAssistants}
          />
          <AttachFragment
            fileUploaderService={fileUploaderService}
            editorService={editorService}
          />
        </div>
        <Button
          size="sm"
          icon={ArrowUpIcon}
          variant="highlight"
          disabled={editorService.isEmpty()}
          onClick={async () => {
            const jsonContent = editorService.getTextAndMentions();
            onEnterKeyDown(editorService.isEmpty(), jsonContent, () => {
              editorService.clearEditor();
            });
          }}
        />
      </div>
    </div>
  );
};
