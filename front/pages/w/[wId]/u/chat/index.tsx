import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useState } from "react";
import TextareaAutosize from "react-textarea-autosize";

import AppLayout from "@app/components/AppLayout";
import { Spinner } from "@app/components/Spinner";
import MainTab from "@app/components/use/MainTab";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";
import { ConnectorProvider } from "@app/lib/connectors_api";
import { DustAppType, prodAPIForOwner } from "@app/lib/dust_api";
import { classNames } from "@app/lib/utils";
import { UserType, WorkspaceType } from "@app/types/user";

const { GA_TRACKING_ID = "" } = process.env;

const DustProdRegistry: { [key: string]: DustAppType } = {
  main: {
    workspaceId: "78bda07b39",
    appId: "6fe1383f11",
    appHash: "390d89f3dc3bb4d6c1fc183507b033a8d2676a042e83d33b95eebf35b3e81173",
  },
};

const PROVIDER_LOGO_PATH = {
  notion: "/static/notion_32x32.png",
  slack: "/static/slack_32x32.png",
};

type ManagedDataSource = {
  name: string;
  provider: ConnectorProvider;
  selected: boolean;
  logoPath: string;
};

export const getServerSideProps: GetServerSideProps<{
  user: UserType | null;
  owner: WorkspaceType;
  managedDataSources: ManagedDataSource[];
  gaTrackingId: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );

  const owner = auth.workspace();
  if (!owner || !auth.isUser()) {
    return {
      notFound: true,
    };
  }

  const prodAPI = await prodAPIForOwner(owner);

  const dsRes = await prodAPI.getDataSources(prodAPI.workspaceId());
  if (dsRes.isErr()) {
    return {
      notFound: true,
    };
  }

  const dataSources = dsRes.value;

  let managedDataSources = dataSources
    .filter((ds) => ds.connectorProvider)
    .map((ds) => {
      return {
        name: ds.name,
        provider: ds.connectorProvider!,
        selected: true,
        logoPath: PROVIDER_LOGO_PATH[ds.connectorProvider!],
      };
    });

  managedDataSources.sort((a, b) => {
    if (a.provider < b.provider) {
      return -1;
    } else {
      return 1;
    }
  });

  return {
    props: {
      user,
      owner,
      managedDataSources,
      gaTrackingId: GA_TRACKING_ID,
    },
  };
};

type RetrievedDocument = {
  sourceUrl: string;
  title: string;
  provider: ConnectorProvider;
};

type Message = {
  role: "user" | "assistant";
  message: string;
  retrievals: RetrievedDocument[];
};

export default function AppChat({
  user,
  owner,
  managedDataSources,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const isMac =
    typeof window !== "undefined"
      ? navigator.platform.toUpperCase().indexOf("MAC") >= 0
      : false;

  const [messages, setMessages] = useState<Message[]>([]);
  const [dataSources, setDataSources] = useState(managedDataSources);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSwitchDataSourceSelection = (name: string) => {
    const newSelection = dataSources.map((ds) => {
      if (ds.name === name) {
        return {
          ...ds,
          selected: !ds.selected,
        };
      } else {
        return ds;
      }
    });
    setDataSources(newSelection);
  };

  const handleSubmitMessage = async () => {
    // clone messages add new message to the end
    const m = [...messages];
    m.push({
      role: "user",
      message,
      retrievals: [],
    });
    setMessages(m);
    setMessage("");
    setLoading(true);
  };

  return (
    <AppLayout user={user} owner={owner} gaTrackingId={gaTrackingId}>
      <div className="flex flex-col">
        <div className="mt-2 flex flex-initial">
          <MainTab currentTab="Chat" owner={owner} />
        </div>
        <div className="">
          <div className="mx-auto mt-8 max-w-2xl px-6">
            <div className="text-sm">
              {messages.map((m, i) => {
                return (
                  <div key={i} className="whitespace-pre-wrap border">
                    {m.message}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="fixed bottom-0 left-0 z-50 w-full border text-sm">
          <div className="mx-auto mt-8 max-w-2xl px-6">
            <div className="my-2">
              <TextareaAutosize
                minRows={1}
                placeholder={"Ask anything"}
                className={classNames(
                  "block w-full resize-none rounded-sm bg-slate-50 px-2 py-2 font-mono text-[13px] font-normal ring-0 focus:ring-0",
                  "border-slate-200 focus:border-slate-300 focus:ring-0"
                )}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    if (e.key === "Enter" && !loading) {
                      handleSubmitMessage();
                      e.preventDefault();
                    }
                  }
                }}
              />
            </div>
            <div className="mb-4 flex flex-row text-xs">
              <div className="flex flex-initial text-gray-400">
                data sources:
              </div>
              <div className="flex flex-row">
                {dataSources.map((ds) => {
                  return (
                    <div key={ds.name} className="ml-1 flex flex-initial">
                      <div
                        className={classNames(
                          "mr-1 flex h-4 w-4 flex-initial cursor-pointer",
                          ds.selected ? "opacity-100" : "opacity-25"
                        )}
                        onClick={() => {
                          handleSwitchDataSourceSelection(ds.name);
                        }}
                      >
                        <img src={ds.logoPath}></img>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-1 text-gray-400"></div>
              <div className="flex flex-initial text-gray-400">
                {loading ? (
                  <div className="mr-1">
                    <Spinner />
                  </div>
                ) : (
                  <>
                    <span className="font-bold">
                      {isMac ? "⌘" : "ctrl"}
                      +⏎
                    </span>
                    <span className="ml-1 text-gray-300">to submit</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
