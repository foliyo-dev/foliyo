/** Stable object key — public URL is always `/uploads/{key}` (basename, e.g. `abc….webp`). */
export type StorageObject = {
  bytes: Buffer;
  contentType: string;
};

export type StorageDriver = {
  /** Backend id for logs (`local` | `s3`). */
  readonly kind: "local" | "s3";
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<StorageObject | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** List basenames under the uploads prefix (for sync CLI). */
  listKeys(): Promise<string[]>;
};

export type S3StorageConfig = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Object key prefix ending with `/`, default `uploads/`. */
  prefix: string;
  /** Force path-style URLs (MinIO / some R2 setups). */
  forcePathStyle: boolean;
};
