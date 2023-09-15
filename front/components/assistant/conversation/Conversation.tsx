import { useCallback, useEffect, useRef } from "react";

import { AgentMessage } from "@app/components/assistant/conversation/AgentMessage";
import { UserMessage } from "@app/components/assistant/conversation/UserMessage";
import { useEventSource } from "@app/hooks/useEventSource";
import {
  AgentMessageNewEvent,
  UserMessageNewEvent,
} from "@app/lib/api/assistant/conversation";
import { useConversation } from "@app/lib/swr";
import { WorkspaceType } from "@app/types/user";

export default function Conversation({
  conversationId,
  owner,
}: {
  conversationId: string;
  owner: WorkspaceType;
}) {
  const {
    conversation,
    isConversationError,
    isConversationLoading,
    mutateConversation,
  } = useConversation({
    conversationId,
    workspaceId: owner.sId,
  });

  const buildEventSourceURL = useCallback(
    (lastEvent: string | null) => {
      const esURL = `/api/w/${owner.sId}/assistant/conversations/${conversationId}/events`;
      let lastEventId = "";
      if (lastEvent) {
        const eventPayload: {
          eventId: string;
        } = JSON.parse(lastEvent);
        lastEventId = eventPayload.eventId;
      }
      const url = lastEventId ? esURL + "?lastEventId=" + lastEventId : esURL;

      return url;
    },
    [conversationId, owner.sId]
  );
  const { lastMessage } = useEventSource(buildEventSourceURL);
  const eventIds = useRef<string[]>([]);

  useEffect(() => {
    if (!lastMessage) {
      return;
    }
    const eventPayload: {
      eventId: string;
      data: UserMessageNewEvent | AgentMessageNewEvent;
    } = JSON.parse(lastMessage);
    if (!eventIds.current.includes(eventPayload.eventId)) {
      eventIds.current.push(eventPayload.eventId);
      void mutateConversation();
    }
  }, [lastMessage, mutateConversation]);

  if (isConversationLoading) {
    return null;
  } else if (isConversationError) {
    return <div>Error loading conversation</div>;
  }
  if (!conversation) {
    return <div>No conversation here</div>;
  }

  return (
    <div className="flex-col gap-6 ">
      {conversation.content.map((message) =>
        message.map((m) => {
          if (m.visibility === "deleted") {
            return null;
          }
          switch (m.type) {
            case "user_message":
              return (
                <div
                  key={`message-id-${m.sId}`}
                  className="bg-structure-50 py-6"
                >
                  <div className="mx-auto flex max-w-4xl gap-4 px-6">
                    <UserMessage message={m} />
                  </div>
                </div>
              );
            case "agent_message":
              return (
                <div key={`message-id-${m.sId}`} className="py-6">
                  <div className="mx-auto flex max-w-4xl gap-4 px-6">
                    <AgentMessage
                      message={m}
                      owner={owner}
                      conversationId={conversationId}
                    />
                  </div>
                </div>
              );
            default:
              ((message: never) => {
                console.error("Unknown message type", message);
              })(m);
          }
        })
      )}
    </div>
  );
}
