import type { UserType } from "@dust-tt/types";
import type { InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import type { ReactElement } from "react";
import { useCallback, useContext, useEffect, useState } from "react";
import React from "react";

import { ConversationContainer } from "@app/components/assistant/conversation/ConversationContainer";
import type { ConversationLayoutProps } from "@app/components/assistant/conversation/ConversationLayout";
import ConversationLayout from "@app/components/assistant/conversation/ConversationLayout";
import { InputBarContext } from "@app/components/assistant/conversation/input_bar/InputBarContext";
import { CONVERSATION_PARENT_SCROLL_DIV_ID } from "@app/components/assistant/conversation/lib";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";

const { URL = "", GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps = withDefaultUserAuthRequirements<
  ConversationLayoutProps & {
    // Here, override conversationId.
    conversationId: string | null;
    user: UserType;
  }
>(async (context, auth) => {
  const owner = auth.workspace();
  const user = auth.user();
  const subscription = auth.subscription();

  if (!owner || !user || !auth.isUser() || !subscription) {
    const { cId } = context.query;

    if (typeof cId === "string") {
      return {
        redirect: {
          destination: `/w/${context.query.wId}/join?cId=${cId}`,
          permanent: false,
        },
      };
    }

    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const { cId } = context.params;

  return {
    props: {
      user,
      owner,
      subscription,
      baseUrl: URL,
      gaTrackingId: GA_TRACKING_ID,
      conversationId: getValidConversationId(cId),
    },
  };
});

export default function AssistantConversation({
  conversationId: initialConversationId,
  owner,
  subscription,
  user,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [conversationKey, setConversationKey] = useState<string | null>(null);
  const router = useRouter();
  const { animate, setAnimate, setSelectedAssistant } =
    useContext(InputBarContext);

  const setInputbarMention = useCallback(
    (agentSid: string) => {
      setSelectedAssistant({ configurationId: agentSid });
      setAnimate(true);
    },
    [setAnimate, setSelectedAssistant]
  );

  useEffect(() => {
    if (animate) {
      setTimeout(() => setAnimate(false), 500);
    }
  });

  // This useEffect handles whether to change the key of the ConversationContainer
  // or not. Altering the key forces a re-render of the component. A random number
  // is used in the key to maintain the component during the transition from new
  // to the conversation view. The key is reset when navigating to a new conversation.
  useEffect(() => {
    const { cId } = router.query;
    const conversationId = getValidConversationId(cId);

    if (conversationId && initialConversationId) {
      // Set conversation id as key if it exists.
      setConversationKey(conversationId);
    } else if (!conversationId && !initialConversationId) {
      // Force re-render by setting a new key with a random number.
      setConversationKey(`new_${Math.random() * 1000}`);

      // Scroll to the top of the conversation container when clicking on "new".
      const mainTag = document.getElementById(
        CONVERSATION_PARENT_SCROLL_DIV_ID["page"]
      );

      if (mainTag) {
        mainTag.scrollTo(0, 0);
      }
    }

    const handleRouteChange = () => {
      const assistantId = router.query.assistant ?? null;
      if (assistantId && typeof assistantId === "string") {
        setInputbarMention(assistantId);
      }
    };

    // Initial check in case the component mounts with the query already set.
    handleRouteChange();

    router.events.on("routeChangeComplete", handleRouteChange);
    return () => {
      router.events.off("routeChangeComplete", handleRouteChange);
    };
  }, [
    router.query,
    router.events,
    setConversationKey,
    initialConversationId,
    setInputbarMention,
  ]);

  useEffect(() => {
    function handleNewConvoShortcut(event: KeyboardEvent) {
      // Check for Command on Mac or Ctrl on others
      const isModifier = event.metaKey || event.ctrlKey;
      if (isModifier && event.key === "/") {
        void router.push(`/w/${owner.sId}/assistant/new`);
      }
    }

    window.addEventListener("keydown", handleNewConvoShortcut);
    return () => {
      window.removeEventListener("keydown", handleNewConvoShortcut);
    };
  }, [owner.sId, router]);

  return (
    <ConversationContainer
      // Key ensures the component re-renders when conversation changes except for shallow browse.
      key={conversationKey}
      conversationId={initialConversationId}
      owner={owner}
      subscription={subscription}
      user={user}
      setInputbarMention={setInputbarMention}
      setAnimate={setAnimate}
    />
  );
}

AssistantConversation.getLayout = (page: ReactElement, pageProps: any) => {
  return <ConversationLayout pageProps={pageProps}>{page}</ConversationLayout>;
};

function getValidConversationId(cId: unknown) {
  return typeof cId === "string" && cId !== "new" ? cId : null;
}
