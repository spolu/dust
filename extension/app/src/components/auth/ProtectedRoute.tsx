import { Button, Page, Spinner } from "@dust-tt/sparkle";
import type { LightWorkspaceType } from "@dust-tt/types";
import { useAuth } from "@extension/components/auth/AuthProvider";
import type { StoredUser } from "@extension/lib/storage";
import { getPendingUpdate } from "@extension/lib/storage";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type ProtectedRouteProps = {
  children: ReactNode | ((props: ProtectedRouteChildrenProps) => ReactNode);
};

export type ProtectedRouteChildrenProps = {
  user: StoredUser;
  workspace: LightWorkspaceType;
  handleLogout: () => void;
};

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const {
    isLoading,
    isAuthenticated,
    isUserSetup,
    user,
    workspace,
    handleLogout,
  } = useAuth();

  const navigate = useNavigate();
  const [isLatestVersion, setIsLatestVersion] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !isUserSetup || !user || !workspace) {
      navigate("/login");
      return;
    }
  }, [navigate, isLoading, isAuthenticated, isUserSetup, user, workspace]);

  const checkIsLatestVersion = async () => {
    const pendingUpdate = await getPendingUpdate();
    if (!pendingUpdate) {
      return null;
    }
    if (pendingUpdate.version > chrome.runtime.getManifest().version) {
      setIsLatestVersion(false);
    }
  };

  useEffect(() => {
    void checkIsLatestVersion();

    chrome.storage.local.onChanged.addListener((changes) => {
      if (changes.pendingUpdate) {
        void checkIsLatestVersion();
      }
    });
  }, []);

  if (isLoading || !isAuthenticated || !isUserSetup || !user || !workspace) {
    return (
      <div className="flex h-screen flex-col gap-2 p-4">
        <div className="flex h-full w-full items-center justify-center">
          <Spinner />
        </div>
      </div>
    );
  }

  if (!isLatestVersion) {
    return (
      <div className="flex h-screen flex-col gap-2 p-4">
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 text-center">
          <Page.SectionHeader title="The extension will update and you'll need to click the extension icon to reopen the panel." />
          <Button
            label="Update now"
            onClick={async () => {
              chrome.runtime.reload();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col gap-2 p-4">
      {typeof children === "function"
        ? children({ user, workspace, handleLogout })
        : children}
    </div>
  );
};
