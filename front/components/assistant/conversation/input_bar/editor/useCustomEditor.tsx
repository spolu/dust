import type { LightAgentConfigurationType } from "@dust-tt/types";
import Bold from "@tiptap/extension-bold";
import { MentionPluginKey } from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import type { Editor, JSONContent } from "@tiptap/react";
import { useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";

import { MentionStorage } from "@app/components/assistant/conversation/input_bar/editor/MentionStorage";
import { MentionWithPaste } from "@app/components/assistant/conversation/input_bar/editor/MentionWithPaste";
import type { EditorSuggestions } from "@app/components/assistant/conversation/input_bar/editor/suggestion";
import { makeGetAssistantSuggestions } from "@app/components/assistant/conversation/input_bar/editor/suggestion";
import { ParagraphExtension } from "@app/components/text_editor/extensions";
import { isMobile } from "@app/lib/utils";

export interface EditorMention {
  id: string;
  label: string;
}

function getTextAndMentionsFromNode(node?: JSONContent) {
  let textContent = "";
  let mentions: EditorMention[] = [];

  if (!node) {
    return { mentions, text: textContent };
  }

  // Check if the node is of type 'text' and concatenate its text.
  if (node.type === "text") {
    textContent += node.text;
  }

  // If the node is a 'mention', concatenate the mention label and add to mentions array.
  if (node.type === "mention") {
    // TODO: We should not expose `sId` here.
    textContent += `:mention[${node.attrs?.label}]{sId=${node.attrs?.id}}`;
    mentions.push({
      id: node.attrs?.id,
      label: node.attrs?.label,
    });
  }

  // If the node is a 'hardBreak' or a 'paragraph', add a newline character.
  if (node.type && ["hardBreak", "paragraph"].includes(node.type)) {
    textContent += "\n";
  }

  // If the node has content, recursively get text and mentions from each child node
  if (node.content) {
    node.content.forEach((childNode) => {
      const childResult = getTextAndMentionsFromNode(childNode);
      textContent += childResult.text;
      mentions = mentions.concat(childResult.mentions);
    });
  }

  return { text: textContent, mentions: mentions };
}

export function getJSONFromText(
  text: string,
  agentConfigurations: LightAgentConfigurationType[]
): JSONContent {
  const mentionRegex =
    /(:mention\[[a-zA-Z0-9_.=-]+]\{sId=([a-zA-Z0-9_.=-]+)})+/g;
  const trimmedText = text.trim();
  const content = [];
  let matches;
  let lastIndex = 0;
  while ((matches = mentionRegex.exec(trimmedText)) !== null) {
    if (mentionRegex.lastIndex - matches[0].length > 0) {
      content.push({
        type: "text",
        text: trimmedText.substring(
          lastIndex,
          mentionRegex.lastIndex - matches[0].length
        ),
      });
    }
    lastIndex = mentionRegex.lastIndex;
    const id = matches[2];
    const label =
      agentConfigurations.find((a) => a.sId === id)?.name || "Unknown";
    content.push({
      type: "mention",
      attrs: { id, label },
    });
  }
  if (lastIndex < trimmedText.length) {
    content.push({
      type: "text",
      text: trimmedText.substring(lastIndex),
    });
  }

  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content,
      },
    ],
  };
}

const useEditorService = (editor: Editor | null) => {
  const editorService = useMemo(() => {
    // Return the service object with utility functions
    return {
      // Insert mention helper function
      insertMention: ({ id, label }: { id: string; label: string }) => {
        const shouldAddSpaceBeforeMention =
          !editor?.isEmpty &&
          editor?.getText()[editor?.getText().length - 1] !== " ";
        editor
          ?.chain()
          .focus()
          .insertContent(shouldAddSpaceBeforeMention ? " " : "") // Add an extra space before the mention.
          .insertContent({
            type: "mention",
            attrs: { id, label },
          })
          .insertContent(" ") // Add an extra space after the mention.
          .run();
      },

      resetWithMentions: (
        mentions: EditorMention[],
        disableAutoFocus: boolean
      ) => {
        const chainCommands = editor?.chain();

        if (!disableAutoFocus) {
          chainCommands?.focus();
        }

        chainCommands?.clearContent();

        mentions.forEach(
          (m) =>
            chainCommands
              ?.insertContent({
                type: "mention",
                attrs: m,
              })
              .insertContent(" ") // Add an extra space after the mention.
        );

        chainCommands?.run();
      },

      focusEnd() {
        editor?.commands.focus("end");
      },

      isEmpty() {
        return editor?.isEmpty ?? true;
      },

      getJSONContent() {
        return editor?.getJSON();
      },

      setJSONContent(content: JSONContent) {
        editor?.commands.setContent(content);
      },

      getTextAndMentions() {
        const { mentions, text } = getTextAndMentionsFromNode(
          editor?.getJSON()
        );

        return {
          mentions,
          text: text.trim(),
        };
      },

      hasMention(mention: EditorMention) {
        const { mentions } = this.getTextAndMentions();
        return mentions.some((m) => m.id === mention.id);
      },

      getTrimmedText() {
        return editor?.getText().trim();
      },

      clearEditor() {
        return editor?.commands.clearContent();
      },

      setLoading(loading: boolean) {
        if (loading) {
          editor?.view.dom.classList.add("loading-text");
        } else {
          editor?.view.dom.classList.remove("loading-text");
        }
        return editor?.setEditable(!loading);
      },
    };
  }, [editor]);

  return editorService;
};

export type EditorService = ReturnType<typeof useEditorService>;

export interface CustomEditorProps {
  onEnterKeyDown: (
    isEmpty: boolean,
    textAndMentions: ReturnType<typeof getTextAndMentionsFromNode>,
    clearEditor: () => void,
    setLoading: (loading: boolean) => void
  ) => void;
  suggestions: EditorSuggestions;
  resetEditorContainerSize: () => void;
  disableAutoFocus: boolean;
  content?: JSONContent;
}

const CustomBold = Bold.extend({
  addKeyboardShortcuts() {
    return {
      "Mod-b": () => false,
    };
  },
});

const useCustomEditor = ({
  onEnterKeyDown,
  resetEditorContainerSize,
  suggestions,
  disableAutoFocus,
  content,
}: CustomEditorProps) => {
  const editor = useEditor({
    autofocus: disableAutoFocus ? false : "end",
    enableInputRules: false, // Disable Markdown when typing.
    enablePasteRules: [MentionWithPaste.name], // We don't want Markdown when pasting but we allow CustomMention extension as it will handle parsing @assistant-name from plain text back into a mention.
    content,
    extensions: [
      StarterKit.configure({
        heading: false,
        // Disable the paragraph extension to handle Enter key press manually.
        paragraph: false,
        // Disable the default Bold extension from StarterKit
        bold: false,
      }),
      CustomBold,
      ParagraphExtension,
      MentionStorage,
      MentionWithPaste.configure({
        HTMLAttributes: {
          class:
            "min-w-0 px-0 py-0 border-none outline-none focus:outline-none focus:border-none ring-0 focus:ring-0 text-brand font-medium",
        },
        suggestion: makeGetAssistantSuggestions(),
      }),
      Placeholder.configure({
        placeholder: "Ask a question or get some @help",
        emptyNodeClass:
          "first:before:text-gray-400 first:before:float-left first:before:content-[attr(data-placeholder)] first:before:pointer-events-none first:before:h-0",
      }),
    ],
  });

  // Sync the extension's MentionStorage suggestions whenever the local suggestions state updates.
  useEffect(() => {
    if (editor) {
      editor.storage.MentionStorage.suggestions = suggestions;
    }
  }, [suggestions, editor]);

  editor?.setOptions({
    editorProps: {
      attributes: {
        class: "border-0 outline-none overflow-y-auto h-full scrollbar-hide",
      },
      handleKeyDown: (view, event) => {
        if (
          event.key === "Enter" &&
          !event.shiftKey &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          const mentionPluginState = MentionPluginKey.getState(view.state);
          // Let the mention extension handle the event if its dropdown is currently opened.
          if (mentionPluginState?.active) {
            return false;
          }

          // On mobile, we want to let the user go to the next line and not immediately send
          if (isMobile(navigator)) {
            return false;
          }

          // Prevent the default Enter key behavior
          event.preventDefault();

          const clearEditor = () => {
            editor.commands.clearContent();
            resetEditorContainerSize();
          };

          const setLoading = (loading: boolean) => {
            if (loading) {
              editor?.view.dom.classList.add("loading-text");
            } else {
              editor?.view.dom.classList.remove("loading-text");
            }
            return editor?.setEditable(!loading);
          };

          onEnterKeyDown(
            editor.isEmpty,
            getTextAndMentionsFromNode(editor.getJSON()),
            clearEditor,
            setLoading
          );

          // Return true to indicate that this key event has been handled.
          return true;
        }

        // Return false to let other keydown handlers or TipTap's default behavior process the event.
        return false;
      },
    },
  });

  const editorService = useEditorService(editor);

  // Expose the editor instance and the editor service.
  return {
    editor,
    editorService,
  };
};

export default useCustomEditor;
