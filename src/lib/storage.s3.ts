import type { StorageAdapter, SignedPut } from "./storage";
import { getSignedUploadUrl } from "./s3";

export class S3Adapter implements StorageAdapter {
  async getSignedUpload(path: string, contentType?: string): Promise<SignedPut> {
    const result = await getSignedUploadUrl(
      path,
      contentType ?? "application/octet-stream"
    );
    return {
      url: result.url,
      publicUrl: result.publicUrl,
      method: "PUT",
    };
  }
}
