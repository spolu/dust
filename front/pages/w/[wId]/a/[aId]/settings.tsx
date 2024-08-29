import { Button, Tab } from "@dust-tt/sparkle";
import type { WorkspaceType } from "@dust-tt/types";
import type { AppType, AppVisibility } from "@dust-tt/types";
import type { SubscriptionType } from "@dust-tt/types";
import type { APIError } from "@dust-tt/types";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import type { InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import { useContext, useState } from "react";
import { useEffect } from "react";

import { ConfirmContext } from "@app/components/Confirm";
import {
  subNavigationApp,
  subNavigationBuild,
} from "@app/components/navigation/config";
import AppLayout from "@app/components/sparkle/AppLayout";
import { AppLayoutSimpleCloseTitle } from "@app/components/sparkle/AppLayoutTitle";
import { getApp } from "@app/lib/api/app";
import { withDefaultUserAuthRequirements } from "@app/lib/iam/session";
import { classNames, MODELS_STRING_MAX_LENGTH } from "@app/lib/utils";
import { getDustAppsListUrl } from "@app/lib/vault_rollout";

const { GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps = withDefaultUserAuthRequirements<{
  owner: WorkspaceType;
  subscription: SubscriptionType;
  app: AppType;
  dustAppsListUrl: string;
  gaTrackingId: string;
}>(async (context, auth) => {
  const owner = auth.workspace();
  const subscription = auth.subscription();
  if (!owner || !subscription) {
    return {
      notFound: true,
    };
  }

  if (!auth.isBuilder()) {
    return {
      redirect: {
        destination: `/w/${owner.sId}/a/${context.query.aId}`,
        permanent: false,
      },
    };
  }

  const app = await getApp(auth, context.params?.aId as string);

  if (!app) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      owner,
      subscription,
      app,
      dustAppsListUrl: await getDustAppsListUrl(auth),
      gaTrackingId: GA_TRACKING_ID,
    },
  };
});

export default function SettingsView({
  owner,
  subscription,
  app,
  dustAppsListUrl,
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [disable, setDisabled] = useState(true);

  const [appName, setAppName] = useState(app.name);
  const [appNameError, setAppNameError] = useState("");

  const [appDescription, setAppDescription] = useState(app.description || "");
  const [appVisibility, setAppVisibility] = useState(app.visibility);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const confirm = useContext(ConfirmContext);

  const formValidation = () => {
    if (appName.length == 0) {
      setAppNameError("");
      return false;
      // eslint-disable-next-line no-useless-escape
    } else if (!appName.match(/^[a-zA-Z0-9\._\-]+$/)) {
      setAppNameError(
        "App name must only contain letters, numbers, and the characters `._-`"
      );
      return false;
    } else {
      setAppNameError("");
      return true;
    }
  };

  const router = useRouter();

  const handleDelete = async () => {
    if (
      await confirm({
        title: "Double checking",
        message: "Are you sure you want to delete this app?",
        validateVariant: "primaryWarning",
      })
    ) {
      setIsDeleting(true);
      const res = await fetch(`/api/w/${owner.sId}/apps/${app.sId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await router.push(dustAppsListUrl);
      } else {
        setIsDeleting(false);
        const err = (await res.json()) as { error: APIError };
        window.alert(
          `Failed to delete the app (contact support@dust.tt for assistance) (internal error: type=${err.error.type} message=${err.error.message})`
        );
      }
      return true;
    } else {
      return false;
    }
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    const res = await fetch(`/api/w/${owner.sId}/apps/${app.sId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: appName.slice(0, MODELS_STRING_MAX_LENGTH),
        description: appDescription.slice(0, MODELS_STRING_MAX_LENGTH),
        visibility: appVisibility,
      }),
    });
    if (res.ok) {
      await router.push(`/w/${owner.sId}/a/${app.sId}`);
    } else {
      setIsUpdating(false);
      const err = (await res.json()) as { error: APIError };
      window.alert(
        `Failed to update the app (contact support@dust.tt for assistance) (internal error: type=${err.error.type} message=${err.error.message})`
      );
    }
  };

  useEffect(() => {
    setDisabled(!formValidation());

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appName]);

  return (
    <AppLayout
      subscription={subscription}
      owner={owner}
      gaTrackingId={gaTrackingId}
      subNavigation={subNavigationBuild({
        owner,
        current: "developers",
      })}
      titleChildren={
        <AppLayoutSimpleCloseTitle
          title={app.name}
          onClose={() => {
            void router.push(dustAppsListUrl);
          }}
        />
      }
      hideSidebar
    >
      <div className="flex w-full flex-col">
        <Tab
          className="mt-2"
          tabs={subNavigationApp({ owner, app, current: "settings" })}
        />
        <div className="mt-8 flex flex-1">
          <div className="space-y-8 divide-y divide-gray-200">
            <div className="space-y-4 divide-y divide-gray-200">
              <div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-6">
                  <div className="sm:col-span-3">
                    <label
                      htmlFor="appName"
                      className="block text-sm font-medium text-gray-700"
                    >
                      App Name
                    </label>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 pl-3 pr-1 text-sm text-gray-500">
                        {owner.name}
                        <ChevronRightIcon
                          className="h-5 w-5 flex-shrink-0 pt-0.5 text-gray-400"
                          aria-hidden="true"
                        />
                      </span>
                      <input
                        type="text"
                        name="name"
                        id="appName"
                        className={classNames(
                          "block w-full min-w-0 flex-1 rounded-none rounded-r-md text-sm",
                          appNameError
                            ? "border-gray-300 border-red-500 focus:border-red-500 focus:ring-red-500"
                            : "border-gray-300 focus:border-action-500 focus:ring-action-500"
                        )}
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <div className="flex justify-between">
                      <label
                        htmlFor="appDescription"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Description
                      </label>
                      <div className="text-sm font-normal text-gray-400">
                        optional but highly recommended
                      </div>
                    </div>
                    <div className="mt-1 flex rounded-md shadow-sm">
                      <input
                        type="text"
                        name="description"
                        id="appDescription"
                        className="block w-full min-w-0 flex-1 rounded-md border-gray-300 text-sm focus:border-action-500 focus:ring-action-500"
                        value={appDescription}
                        onChange={(e) => setAppDescription(e.target.value)}
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      This description guides assistants in understanding how to
                      use your app effectively and determines its relevance in
                      responding to user inquiries. If you don't provide a
                      description, members won't be able to select this app in
                      the Assistant Builder.
                    </p>
                  </div>

                  <div className="sm:col-span-6">
                    <fieldset className="mt-2">
                      <legend className="contents text-sm font-medium text-gray-700">
                        Visibility
                      </legend>
                      <div className="mt-4 space-y-4">
                        <div className="flex items-center">
                          <input
                            id="appVisibilityPublic"
                            name="visibility"
                            type="radio"
                            className="h-4 w-4 cursor-pointer border-gray-300 text-action-600 focus:ring-action-500"
                            value="public"
                            checked={appVisibility == "public"}
                            onChange={(e) => {
                              if (e.target.value != appVisibility) {
                                setAppVisibility(
                                  e.target.value as AppVisibility
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor="appVisibilityPublic"
                            className="ml-3 block text-sm font-medium text-gray-700"
                          >
                            Public
                            <p className="mt-0 text-sm font-normal text-gray-500">
                              Anyone on the Internet with the link can see the
                              app. Only builders of your workspace can edit.
                            </p>
                          </label>
                        </div>
                        <div className="flex items-center">
                          <input
                            id="appVisibilityPrivate"
                            name="visibility"
                            type="radio"
                            value="private"
                            className="h-4 w-4 cursor-pointer border-gray-300 text-action-600 focus:ring-action-500"
                            checked={appVisibility == "private"}
                            onChange={(e) => {
                              if (e.target.value != appVisibility) {
                                setAppVisibility(
                                  e.target.value as AppVisibility
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor="appVisibilityPrivate"
                            className="ml-3 block text-sm font-medium text-gray-700"
                          >
                            Private
                            <p className="mt-0 text-sm font-normal text-gray-500">
                              Only builders of your workspace can see and edit
                              the app.
                            </p>
                          </label>
                        </div>
                      </div>
                      {appVisibility == "deleted" ? (
                        <p className="mt-4 text-sm font-normal text-gray-500">
                          This app is currently marked as deleted. Change its
                          visibility above to restore it.
                        </p>
                      ) : null}
                    </fieldset>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex py-6">
              <Button
                disabled={disable || isUpdating || isDeleting}
                onClick={handleUpdate}
                label={isUpdating ? "Updating..." : "Update"}
              />
              <div className="flex-1"></div>
              <div className="flex">
                <Button
                  variant="secondary"
                  onClick={() => {
                    void router.push(`/w/${owner.sId}/a/${app.sId}/clone`);
                  }}
                  label="Clone"
                />
              </div>
              <div className="ml-2 flex">
                <Button
                  variant="secondaryWarning"
                  onClick={handleDelete}
                  disabled={isDeleting || isUpdating}
                  label={isDeleting ? "Deleting..." : "Delete"}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
