import type { Bucket } from "@google-cloud/storage";
import { Storage } from "@google-cloud/storage";
import type formidable from "formidable";
import fs from "fs";
import { pipeline } from "stream/promises";

import config from "@app/lib/file_storage/config";
import { isGCSNotFoundError } from "@app/lib/file_storage/types";

const DEFAULT_SIGNED_URL_EXPIRATION_DELAY_MS = 5 * 60 * 1000; // 5 minutes.

class FileStorage {
  private readonly bucket: Bucket;
  private readonly storage: Storage;

  constructor(bucketKey: string) {
    this.storage = new Storage({
      keyFilename: config.getServiceAccount(),
    });

    this.bucket = this.storage.bucket(bucketKey);
  }

  /**
   * Upload functions.
   */

  async uploadFileToBucket(file: formidable.File, destPath: string) {
    const gcsFile = this.file(destPath);
    const fileStream = fs.createReadStream(file.filepath);

    await pipeline(
      fileStream,
      gcsFile.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      })
    );
  }

  async uploadRawContentToBucket({
    content,
    contentType,
    filePath,
  }: {
    content: string;
    contentType: string;
    filePath: string;
  }) {
    const gcsFile = this.file(filePath);

    await gcsFile.save(content, {
      contentType,
    });
  }

  /**
   * Download functions.
   */

  async fetchFileContent(filePath: string) {
    const gcsFile = this.file(filePath);

    const [content] = await gcsFile.download();

    return content.toString();
  }

  async getFileContentType(filename: string): Promise<string | null> {
    const gcsFile = this.file(filename);

    const [metadata] = await gcsFile.getMetadata();

    return metadata.contentType;
  }

  async getSignedUrl(
    filename: string,
    expirationDelay = DEFAULT_SIGNED_URL_EXPIRATION_DELAY_MS
  ): Promise<string> {
    const gcsFile = this.file(filename);

    const signedUrl = await gcsFile.getSignedUrl({
      action: "read",
      expires: new Date().getTime() + expirationDelay,
    });

    return signedUrl.toString();
  }

  file(filename: string) {
    return this.bucket.file(filename);
  }

  get name() {
    return this.bucket.name;
  }

  /**
   * Delete functions.
   */

  async delete(
    filePath: string,
    { ignoreNotFound }: { ignoreNotFound?: boolean } = {}
  ) {
    try {
      return await this.file(filePath).delete();
    } catch (err) {
      if (ignoreNotFound && isGCSNotFoundError(err)) {
        return;
      }

      throw err;
    }
  }
}

const bucketInstances = new Map();

const getBucketInstance: BucketGetter = (bucketConfig: string) => {
  if (!bucketInstances.has(bucketConfig)) {
    bucketInstances.set(bucketConfig, new FileStorage(bucketConfig));
  }
  return bucketInstances.get(bucketConfig);
};

type BucketGetter = (bucketConfig: string) => FileStorage;

export const getPrivateUploadBucket = () =>
  getBucketInstance(config.getGcsPrivateUploadsBucket());

export const getPublicUploadBucket = () =>
  getBucketInstance(config.getGcsPublicUploadBucket());
