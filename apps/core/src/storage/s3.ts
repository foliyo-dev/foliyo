import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { S3StorageConfig, StorageDriver, StorageObject } from "./types.js";

function contentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  // Node.js Readable / web stream from SDK
  const stream = body as AsyncIterable<Uint8Array>;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function createS3Storage(cfg: S3StorageConfig): StorageDriver {
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: cfg.forcePathStyle,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });

  const prefix = cfg.prefix.endsWith("/") ? cfg.prefix : `${cfg.prefix}/`;

  function objectKey(key: string): string {
    return `${prefix}${key}`;
  }

  return {
    kind: "s3",
    async put(key, bytes, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: objectKey(key),
          Body: bytes,
          ContentType: contentType || contentTypeForKey(key),
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    },
    async get(key): Promise<StorageObject | null> {
      try {
        const res = await client.send(
          new GetObjectCommand({
            Bucket: cfg.bucket,
            Key: objectKey(key),
          }),
        );
        const bytes = await bodyToBuffer(res.Body);
        return {
          bytes,
          contentType: res.ContentType || contentTypeForKey(key),
        };
      } catch (err) {
        const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
        const status =
          err && typeof err === "object" && "$metadata" in err
            ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
            : undefined;
        if (name === "NoSuchKey" || name === "NotFound" || status === 404) return null;
        throw err;
      }
    },
    async delete(key) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: cfg.bucket,
          Key: objectKey(key),
        }),
      );
    },
    async exists(key) {
      try {
        await client.send(
          new HeadObjectCommand({
            Bucket: cfg.bucket,
            Key: objectKey(key),
          }),
        );
        return true;
      } catch (err) {
        const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
        const status =
          err && typeof err === "object" && "$metadata" in err
            ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
            : undefined;
        if (name === "NotFound" || name === "NoSuchKey" || status === 404) return false;
        throw err;
      }
    },
    async listKeys() {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const res = await client.send(
          new ListObjectsV2Command({
            Bucket: cfg.bucket,
            Prefix: prefix,
            ContinuationToken: token,
          }),
        );
        for (const obj of res.Contents ?? []) {
          const full = obj.Key ?? "";
          if (!full.startsWith(prefix)) continue;
          const base = full.slice(prefix.length);
          if (/^[a-f0-9]{32}\.(jpe?g|png|webp)$/i.test(base)) keys.push(base);
        }
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
      } while (token);
      return keys;
    },
  };
}
