import {
  Avatar,
  Button,
  ChatBubbleBottomCenterTextIcon,
  Icon,
  PageHeader,
  QuestionMarkCircleStrokeIcon,
} from "@dust-tt/sparkle";
import { FlagIcon, HandRaisedIcon } from "@heroicons/react/24/outline";
import * as t from "io-ts";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import { useState } from "react";

import Conversation from "@app/components/assistant/conversation/Conversation";
import { ConversationTitle } from "@app/components/assistant/conversation/ConversationTitle";
import { FixedAssistantInputBar } from "@app/components/assistant/conversation/InputBar";
import { AssistantSidebarMenu } from "@app/components/assistant/conversation/SidebarMenu";
import AppLayout from "@app/components/sparkle/AppLayout";
import { getFeaturedAgentConfigurations } from "@app/lib/api/assistant/configuration";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";
import type {
  PostConversationsRequestBodySchema,
  PostConversationsResponseBody,
} from "@app/pages/api/w/[wId]/assistant/conversations";
import { AgentConfigurationType } from "@app/types/assistant/agent";
import {
  ConversationType,
  MentionType,
} from "@app/types/assistant/conversation";
import { UserType, WorkspaceType } from "@app/types/user";

const { URL = "", GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps: GetServerSideProps<{
  user: UserType;
  owner: WorkspaceType;
  featuredAgents: AgentConfigurationType[];
  baseUrl: string;
  gaTrackingId: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );

  const owner = auth.workspace();
  if (!owner || !auth.isUser() || !user) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const featuredAgents = await getFeaturedAgentConfigurations(auth);

  return {
    props: {
      user,
      owner,
      featuredAgents,
      baseUrl: URL,
      gaTrackingId: GA_TRACKING_ID,
    },
  };
};

export default function AssistantNew({
  user,
  owner,
  featuredAgents,
  baseUrl,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();

  const [conversation, setConversation] = useState<ConversationType | null>(
    null
  );

  const handleSubmit = async (input: string, mentions: MentionType[]) => {
    const body: t.TypeOf<typeof PostConversationsRequestBodySchema> = {
      title: null,
      visibility: "unlisted",
      message: {
        content: input,
        context: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          profilePictureUrl: user.image,
        },
        mentions,
      },
    };

    // Create new conversation and post the initial message at the same time.
    const cRes = await fetch(`/api/w/${owner.sId}/assistant/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!cRes.ok) {
      const data = await cRes.json();
      window.alert(`Error creating conversation: ${data.error.message}`);
      return;
    }

    const conversation = ((await cRes.json()) as PostConversationsResponseBody)
      .conversation;

    // We use this to clear the UI start rendering the conversation immediately to give an
    // impression of instantaneity.
    setConversation(conversation);

    // We start the push before creating the message to optimize for instantaneity as well.
    void router.push(`/w/${owner.sId}/assistant/${conversation.sId}`);
  };

  return (
    <AppLayout
      user={user}
      owner={owner}
      isWideMode={conversation ? true : false}
      gaTrackingId={gaTrackingId}
      topNavigationCurrent="assistant_v2"
      titleChildren={
        conversation && (
          <ConversationTitle
            title={conversation.title || ""}
            shareLink={`${baseUrl}/w/${owner.sId}/assistant/${conversation.sId}`}
            onUpdateVisibility={() => {
              return;
            }}
            visibility={"unlisted"}
          />
        )
      }
      navChildren={<AssistantSidebarMenu owner={owner} />}
    >
      {!conversation ? (
        <>
          <PageHeader
            title="Welcome to Assistant"
            icon={ChatBubbleBottomCenterTextIcon}
          />

          {/* GETTING STARTED */}
          <div className="flex flex-col gap-8">
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <Icon visual={FlagIcon} size="md" />
                <span className="text-lg font-bold">Getting started?</span>
              </div>
              <p className="text-element-700">
                Using assistant is easy as asking a question to a friend or a
                coworker.
                <br />
                Try it out:
              </p>
              <div>
                <Button
                  variant={"primary"}
                  icon={ChatBubbleBottomCenterTextIcon}
                  label="Hey @helper, how do I use the assistant?"
                  onClick={() => {
                    window.alert("To be implemented, sorry!");
                  }}
                />
              </div>
            </div>

            {/* FEATURED AGENTS */}
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <Icon visual={HandRaisedIcon} size="md" />
                <span className="text-lg font-bold">
                  Meet your smart friends
                </span>
              </div>
              <p className="text-element-700">
                Dust is not just a single assistant, it’s a full team at your
                service.
                <br />
                Each member has a set of specific set skills.
              </p>
              <p className="text-element-700">
                Meet some of your Assistants team:
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-4 gap-2">
                {featuredAgents.map((agent) => (
                  <div key={agent.sId} className="flex flex-col gap-1">
                    <Avatar
                      visual={<img src={agent.pictureUrl} alt="Agent Avatar" />}
                      size={"sm"}
                    />
                    <div>
                      <div className="text-md font-bold text-element-900">
                        @{agent.name}
                      </div>
                      <div className="text-sm text-element-700">
                        {agent.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <Button
                  variant={"secondary"}
                  icon={ChatBubbleBottomCenterTextIcon}
                  label="Hey @helper, how do I use the assistant?"
                  onClick={() => {
                    window.alert("To be implemented, sorry!");
                  }}
                />
              </div>
            </div>

            {/* FAQ */}
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex flex-row gap-2">
                <Icon visual={QuestionMarkCircleStrokeIcon} size="md" />
                <span className="text-lg font-bold">
                  Frequently asked questions
                </span>
              </div>
              <div>
                <Button
                  variant={"secondary"}
                  icon={ChatBubbleBottomCenterTextIcon}
                  label="@helper, what can I use the Assistant for?"
                  onClick={() => {
                    window.alert("To be implemented, sorry!");
                  }}
                />
                <Button
                  variant={"secondary"}
                  icon={ChatBubbleBottomCenterTextIcon}
                  label="@helper, what are the limitations of the Assistant?"
                  onClick={() => {
                    window.alert("To be implemented, sorry!");
                  }}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <Conversation owner={owner} conversationId={conversation.sId} />
      )}

      <FixedAssistantInputBar owner={owner} onSubmit={handleSubmit} />
    </AppLayout>
  );
}
