import type {
  ContentFragmentInputWithContentType,
  ContentFragmentInputWithFileIdType,
  ModelId,
  Result,
  SupportedFileContentType,
} from "@dust-tt/types";
import { Err, extensionsForContentType, Ok } from "@dust-tt/types";

import { processAndStoreFile } from "@app/lib/api/files/upload";
import type { Authenticator } from "@app/lib/auth";
import { FileResource } from "@app/lib/resources/file_resource";

interface ContentFragmentBlob {
  contentType: SupportedFileContentType;
  fileId: ModelId | null;
  sourceUrl: string | null;
  textBytes: number | null;
  title: string;
}

export async function toFileContentFragment(
  auth: Authenticator,
  {
    contentFragment,
    fileName,
  }: {
    contentFragment: ContentFragmentInputWithContentType;
    fileName?: string;
  }
): Promise<Result<ContentFragmentInputWithFileIdType, { message: string }>> {
  const file = await FileResource.makeNew({
    contentType: contentFragment.contentType,
    fileName:
      fileName ??
      "content" + extensionsForContentType(contentFragment.contentType)[0],
    fileSize: contentFragment.content.length,
    userId: auth.user()?.id,
    workspaceId: auth.getNonNullableWorkspace().id,
    useCase: "conversation",
    useCaseMetadata: null,
  });

  const processRes = await processAndStoreFile(auth, {
    file,
    reqOrString: contentFragment.content,
  });

  if (processRes.isErr()) {
    return new Err({
      message:
        `Error creating file for content fragment: ` + processRes.error.message,
    });
  }

  return new Ok({
    title: contentFragment.title,
    url: contentFragment.url,
    fileId: file.sId,
  });
}

export async function getContentFragmentBlob(
  auth: Authenticator,
  cf: ContentFragmentInputWithFileIdType
): Promise<Result<ContentFragmentBlob, Error>> {
  const { title, url } = cf;

  const file = await FileResource.fetchById(auth, cf.fileId);
  if (!file) {
    return new Err(new Error("File not found."));
  }

  if (file.useCase !== "conversation") {
    return new Err(new Error("File not meant to be used in a conversation."));
  }

  if (!file.isReady) {
    return new Err(
      new Error("The file is not ready. Please re-upload the file to proceed.")
    );
  }

  // Give priority to the URL if it is provided.
  const sourceUrl = url ?? file.getPrivateUrl(auth);
  return new Ok({
    contentType: file.contentType,
    fileId: file.id,
    sourceUrl,
    textBytes: file.fileSize,
    title,
  });
}
