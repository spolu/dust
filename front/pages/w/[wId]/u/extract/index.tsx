import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import React from "react";

import AppLayout from "@app/components/AppLayout";
import { Button } from "@app/components/Button";
import MainTab from "@app/components/use/MainTab";
import { Authenticator, getSession, getUserFromSession } from "@app/lib/auth";
import { useEventSchemas } from "@app/lib/swr";
import { UserType, WorkspaceType } from "@app/types/user";

const { GA_TRACKING_ID = "" } = process.env;
export const getServerSideProps: GetServerSideProps<{
  user: UserType | null;
  owner: WorkspaceType;
  isBuilder: boolean;
  gaTrackingId: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);
  const auth = await Authenticator.fromSession(
    session,
    context.params?.wId as string
  );
  const owner = auth.workspace();
  if (!owner) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      user,
      owner,
      isBuilder: auth.isBuilder(),
      gaTrackingId: GA_TRACKING_ID,
    },
  };
};

export default function AppExtractEvents({
  user,
  owner,
  isBuilder,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const { schemas, isSchemasLoading } = useEventSchemas(owner);

  return (
    <AppLayout
      user={user}
      owner={owner}
      gaTrackingId={gaTrackingId}
      app={undefined}
      dataSource={undefined}
    >
      <div className="flex h-full flex-col">
        <div className="mt-2 flex flex-initial">
          <MainTab currentTab="Extract data" owner={owner} />
        </div>

        <div className="container mx-auto my-10 sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
          <h3 className="text-base font-medium leading-6 text-gray-900">
            Extract events Templates
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            This section allows you to define templates associated to a given
            marker. See for an example{" "}
            <a onClick={() => alert("Not implemented yet, sorry 😬")}>here</a>!
          </p>
          <div className="my-10 flex flex-col">
            <div className="overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 sm:px-6 lg:px-8">
                <div className="overflow-hidden">
                  <table className="min-w-full text-left text-sm font-light">
                    <thead className="border-b bg-white font-medium">
                      <tr>
                        <th scope="col" className="px-3 py-4">
                          Marker
                        </th>
                        <th scope="col" className="px-12 py-4">
                          Description
                        </th>
                        <th scope="col" className="px-3 py-4">
                          Status
                        </th>
                        <th scope="col" className="px-3 py-4">
                          {isBuilder ? "Manage" : "View"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {!isSchemasLoading &&
                        schemas?.map((schema) => (
                          <tr key={schema.marker} className="border-b bg-white">
                            <td className="whitespace-nowrap px-3 py-4 font-medium">
                              {schema.marker}
                            </td>
                            <td className="whitespace-nowrap px-12 py-4">
                              {schema.description}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4">
                              {schema.status === "active" ? "✅" : "❌"}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4">
                              <Button
                                type="submit"
                                onClick={() =>
                                  alert("Not implemented yet, sorry 😬")
                                }
                              >
                                <div>
                                  {isBuilder
                                    ? "Manage template"
                                    : "View template"}
                                </div>
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
