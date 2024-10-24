import { ReachedLimitPopup } from "@app/extension/app/src/components/conversation/ReachedLimitPopup";
import { AssistantInputBar } from "@app/extension/app/src/components/input_bar/InputBar";
import { InputBarContext } from "@app/extension/app/src/components/input_bar/InputBarContext";
import { useSubmitFunction } from "@app/extension/app/src/components/utils/useSubmitFunction";
import {
  postConversation,
  postMessage,
} from "@app/extension/app/src/lib/conversation";
import type { MentionType, WorkspaceType } from "@dust-tt/types";
import { useCallback, useContext, useEffect, useState } from "react";

interface ConversationContainerProps {
  conversationId: string | null;
  owner: WorkspaceType;
}

export function ConversationContainer({
  conversationId,
  owner,
}: ConversationContainerProps) {
  const [activeConversationId, setActiveConversationId] =
    useState(conversationId);
  const [planLimitReached, setPlanLimitReached] = useState(false);

  const { animate, setAnimate } = useContext(InputBarContext);

  // TODO use notification once they are in Sparkle.
  // const sendNotification = useContext(SendNotificationsContext);
  const sendNotification = console.log;

  useEffect(() => {
    if (animate) {
      setTimeout(() => setAnimate(false), 500);
    }
  });

  const handlePostMessage = async (input: string, mentions: MentionType[]) => {
    if (!activeConversationId) {
      return null;
    }
    const messageData = { input, mentions, contentFragments: [] };
    const result = await postMessage({
      owner,
      conversationId: activeConversationId,
      messageData,
    });

    if (result.isErr()) {
      if (result.error.type === "plan_limit_reached_error") {
        setPlanLimitReached(true);
      } else {
        sendNotification({
          title: result.error.title,
          description: result.error.message,
          type: "error",
        });
      }
    } else {
      // TODO (Ext): Handle the message being posted.
    }
  };

  const { submit: handlePostConversation } = useSubmitFunction(
    useCallback(
      async (input: string, mentions: MentionType[]) => {
        const conversationRes = await postConversation({
          owner,
          messageData: {
            input,
            mentions,
          },
        });
        if (conversationRes.isErr()) {
          if (conversationRes.error.type === "plan_limit_reached_error") {
            setPlanLimitReached(true);
          } else {
            sendNotification({
              title: conversationRes.error.title,
              description: conversationRes.error.message,
              type: "error",
            });
          }
        } else {
          setActiveConversationId(conversationRes.value.sId);
          // Probably here we want to navigate to /conversations/id
          // navigate(`/conversations/${conversationRes.value.sId}`);
        }
      },
      [owner, sendNotification, setActiveConversationId]
    )
  );

  return (
    <>
      {activeConversationId && <p>Congrats you just posted a conversation</p>}
      <AssistantInputBar
        owner={owner}
        onSubmit={
          activeConversationId ? handlePostMessage : handlePostConversation
        }
        stickyMentions={[]} //TODO(Ext) do we need this.
      />
      <ReachedLimitPopup
        isOpened={planLimitReached}
        onClose={() => setPlanLimitReached(false)}
        isTrialing={false} // TODO(Ext): Properly handle this from loading the subscription.
      />
    </>
  );
}
