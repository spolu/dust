import { useAuth } from "@extension/components/auth/AuthProvider";
import { logout, refreshToken } from "@extension/lib/auth";
import { useEffect } from "react";

function makeEnterpriseConnectionName(workspaceId: string) {
  return `workspace-${workspaceId}`;
}

export const useAuthErrorCheck = (error: any, mutate: () => any) => {
  const { setAuthError, setForcedConnection, workspace } = useAuth();
  useEffect(() => {
    const handleError = async () => {
      if (error) {
        switch (error.type) {
          case "sso_enforced":
            setAuthError(error);
            if (workspace) {
              setForcedConnection(makeEnterpriseConnectionName(workspace?.sId));
            }
            void logout();
            break;
          case "not_authenticated":
          case "invalid_oauth_token_error":
            setAuthError(error);
            void logout();
            break;
          case "expired_oauth_token_error":
            const res = await refreshToken();
            if (res.isOk()) {
              mutate();
            } else {
              void logout();
            }
            break;
          case "user_not_found":
            setAuthError(error);
            break;
        }
      }
    };
    void handleError();
  }, [error]);
};
