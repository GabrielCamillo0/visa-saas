// src/lib/storage.ts
export type SignedPut = { url: string; publicUrl: string; method?: 'PUT'|'POST'; fields?: Record<string,string> };
export interface StorageAdapter {
  getSignedUpload(path: string, contentType?: string): Promise<SignedPut>;
}

import fs from 'node:fs';
import path from 'node:path';

export class LocalDiskAdapter implements StorageAdapter {
  baseDir = path.join(process.cwd(), '.uploads');
  constructor(){ if(!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir); }
  async getSignedUpload(p: string): Promise<SignedPut> {
    const filePath = path.join(this.baseDir, p);
    const url = `/api/dev-upload?path=${encodeURIComponent(p)}`;
    const publicUrl = `/api/dev-file?path=${encodeURIComponent(p)}`;
    return { url, publicUrl, method: 'POST' };
  }
}
