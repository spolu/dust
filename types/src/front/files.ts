import * as t from "io-ts";

// File upload form validation.

export const FileUploadUrlRequestSchema = t.type({
  fileName: t.string,
  fileSize: t.number,
});

export type FileUploadUrlRequestType = t.TypeOf<
  typeof FileUploadUrlRequestSchema
>;

export interface FileUploadRequestResponseBody {
  fileId: string;
  uploadUrl: string;
}
