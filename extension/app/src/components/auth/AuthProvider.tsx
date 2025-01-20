import type { ExtensionWorkspaceType, WorkspaceType } from "@dust-tt/client";
import { useAuthHook } from "@extension/components/auth/useAuth";
import type { AuthError } from "@extension/lib/auth";
import type { StoredUser } from "@extension/lib/storage";
import type { ReactNode } from "react";
import React, { createContext, useContext } from "react";

type AuthContextType = {
  token: string | null;
  isAuthenticated: boolean;
  authError: AuthError | null;
  setAuthError: (error: AuthError | null) => void;
  enforceSSO: (workspace: WorkspaceType) => void;
  user: StoredUser | null;
  workspace: ExtensionWorkspaceType | undefined;
  isUserSetup: boolean;
  isLoading: boolean;
  handleLogin: (isForceLogin: boolean) => void;
  handleLogout: () => void;
  handleSelectWorkspace: (workspace: WorkspaceType) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const {
    token,
    isAuthenticated,
    authError,
    setAuthError,
    enforceSSO,
    user,
    workspace,
    isUserSetup,
    isLoading,
    handleLogin,
    handleLogout,
    handleSelectWorkspace,
  } = useAuthHook();

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated,
        authError,
        setAuthError,
        enforceSSO,
        user,
        workspace,
        isUserSetup,
        isLoading,
        handleLogin,
        handleLogout,
        handleSelectWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
