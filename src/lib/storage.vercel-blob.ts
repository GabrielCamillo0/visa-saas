import type { StorageAdapter, SignedPut } from "./storage";

/**
 * Placeholder para Vercel Blob. Configure @vercel/blob e implemente
 * getSignedUpload usando createPutUrl ou similar.
 */
export class VercelBlobAdapter implements StorageAdapter {
  async getSignedUpload(path: string, _contentType?: string): Promise<SignedPut> {
    throw new Error(
      "Vercel Blob não configurado. Use STORAGE_PROVIDER=s3 ou default (disco local)."
    );
  }
}
