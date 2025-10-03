// src/lib/storage.factory.ts
import { LocalDiskAdapter } from './storage';
import { S3Adapter } from './storage.s3';       // já existente no seu projeto
import { VercelBlobAdapter } from './storage.vercel-blob';

export function makeStorage() {
  switch (process.env.STORAGE_PROVIDER) {
    case 's3': return new S3Adapter();
    case 'vercel-blob': return new VercelBlobAdapter();
    default: return new LocalDiskAdapter(); // dev
  }
}
