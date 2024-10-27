import type { MessageWithContentFragmentsType } from "@app/components/assistant/conversation/ConversationViewer";
import type { StoredUser } from "@app/extension/app/src/lib/storage";
import type { FetchConversationMessagesResponse } from "@app/lib/api/assistant/messages";
import type {
  ConversationMessageReactions,
  LightWorkspaceType,
} from "@dust-tt/types";
import MessageItem from "@extension/components/conversation/MessageItem";
import React, { useEffect, useRef } from "react";

interface MessageGroupProps {
  messages: MessageWithContentFragmentsType[][];
  isLastMessageGroup: boolean;
  conversationId: string;
  hideReactions: boolean;
  isInModal: boolean;
  owner: LightWorkspaceType;
  reactions: ConversationMessageReactions;
  user: StoredUser;
  latestPage?: FetchConversationMessagesResponse;
}

// arbitrary offset to scroll the last MessageGroup to
const VIEWPORT_OFFSET_RATIO = 0.5;
const MAX_OFFSET_PIXEL = 600;

export const LAST_MESSAGE_GROUP_ID = "last-message-group";

export default function MessageGroup({
  messages,
  isLastMessageGroup,
  conversationId,
  hideReactions,
  isInModal,
  owner,
  reactions,
  user,
  latestPage,
}: MessageGroupProps) {
  const lastMessageGroupRef = useRef<HTMLDivElement>(null);

  const offset = Math.min(
    window.innerHeight * VIEWPORT_OFFSET_RATIO,
    MAX_OFFSET_PIXEL
  );
  const minHeight = isLastMessageGroup ? `${offset}px` : "0px";

  useEffect(() => {
    if (isLastMessageGroup && lastMessageGroupRef.current) {
      lastMessageGroupRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isLastMessageGroup]);

  return (
    <div
      id={isLastMessageGroup ? LAST_MESSAGE_GROUP_ID : ""}
      ref={isLastMessageGroup ? lastMessageGroupRef : undefined}
      style={{ minHeight }}
    >
      {messages.map((group) => {
        return group.map((message) => {
          return (
            <MessageItem
              key={`message-${message.sId}`}
              conversationId={conversationId}
              hideReactions={hideReactions}
              isInModal={isInModal}
              message={message}
              owner={owner}
              reactions={reactions}
              user={user}
              isLastMessage={latestPage?.messages.at(-1)?.sId === message.sId}
            />
          );
        });
      })}
    </div>
  );
}
