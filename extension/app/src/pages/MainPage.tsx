import {
  Avatar,
  BarHeader,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  LogoHorizontalColorLogo,
  LogoutIcon,
} from "@dust-tt/sparkle";
import { AssistantFavorites } from "@extension/components/assistants/AssistantFavorites";
import { useAuth } from "@extension/components/auth/AuthProvider";
import type { ProtectedRouteChildrenProps } from "@extension/components/auth/ProtectedRoute";
import { ConversationContainer } from "@extension/components/conversation/ConversationContainer";
import { ConversationsListButton } from "@extension/components/conversation/ConversationsListButton";
import { FileDropProvider } from "@extension/components/conversation/FileUploaderContext";
import { DropzoneContainer } from "@extension/components/DropzoneContainer";
import { InputBarProvider } from "@extension/components/input_bar/InputBarContext";
import { Link } from "react-router-dom";

export const MainPage = ({
  user,
  workspace,
  handleLogout,
}: ProtectedRouteChildrenProps) => {
  const { handleSelectWorkspace } = useAuth();

  return (
    <>
      <BarHeader
        title={""}
        tooltip={"Conversation"}
        leftActions={
          <div className="flex flex-col gap-2">
            {user.workspaces.length > 1 && (
              <div className="flex flex-row items-center gap-2">
                <p className="text-sm text-slate-500">Workspace:</p>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      label={workspace ? workspace.name : "Select workspace"}
                      variant="ghost"
                      isSelect
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {user.workspaces.map((w) => {
                      return (
                        <DropdownMenuItem
                          key={w.sId}
                          onClick={() => void handleSelectWorkspace(w.sId)}
                          label={w.name}
                        />
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        }
        rightActions={
          <div className="flex flex-row items-right">
            <ConversationsListButton size="md" />

            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="px-2">
                  <Avatar
                    size="md"
                    visual={
                      user.image
                        ? user.image
                        : "https://gravatar.com/avatar/anonymous?d=mp"
                    }
                    onClick={() => {
                      "clickable";
                    }}
                  />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  icon={LogoutIcon}
                  label="Sign out"
                  onClick={handleLogout}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      <div className="flex items-start justify-between">
        <div className="fixed bottom-0 right-0 z-10">
          <Link to="https://dust.tt" target="_blank">
            <div className="rounded-tl-2xl border-t border-l border-gray-200 bg-white p-4">
              <LogoHorizontalColorLogo className="h-6 w-24" />
            </div>
          </Link>
        </div>
      </div>
      <div className="h-full w-full pt-28 max-w-4xl mx-auto flex justify-center">
        <FileDropProvider>
          <DropzoneContainer
            description="Drag and drop your text files (txt, doc, pdf) and image files (jpg, png) here."
            title="Attach files to the conversation"
          >
            <InputBarProvider>
              <ConversationContainer
                owner={workspace}
                conversationId={null}
                user={user}
              />
              <AssistantFavorites />
            </InputBarProvider>
          </DropzoneContainer>
        </FileDropProvider>
      </div>
    </>
  );
};
