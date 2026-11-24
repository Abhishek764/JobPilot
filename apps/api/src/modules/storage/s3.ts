import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { env } from '../../config/env';
import { AppError } from '../../shared/errors';

let client: S3Client | null = null;

export const isStorageConfigured = (): boolean =>
  Boolean(env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

const getClient = (): S3Client => {
  if (!isStorageConfigured()) {
    throw new AppError('Object storage is not configured', 503, 'STORAGE_UNCONFIGURED');
  }
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
};

const bucket = (): string => env.S3_BUCKET!;

export const storage = {
  isConfigured: isStorageConfigured,

  /** Presigned PUT for a direct browser upload. */
  presignUpload: (key: string, contentType: string): Promise<string> =>
    getSignedUrl(
      getClient(),
      new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
      { expiresIn: env.RESUME_URL_TTL_SECONDS },
    ),

  /** Presigned GET for downloading an object. */
  presignDownload: (key: string, filename?: string): Promise<string> =>
    getSignedUrl(
      getClient(),
      new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
        ...(filename ? { ResponseContentDisposition: `attachment; filename="${filename}"` } : {}),
      }),
      { expiresIn: env.RESUME_URL_TTL_SECONDS },
    ),

  putObject: async (key: string, body: Buffer, contentType: string): Promise<void> => {
    await getClient().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
    );
  },

  getObject: async (key: string): Promise<Buffer> => {
    const res = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) throw new AppError('Empty object', 502, 'STORAGE_EMPTY');
    return Buffer.from(bytes);
  },

  /** Stored size of an object, or null when it doesn't exist. Presigned PUTs don't bind size, so check here. */
  headObject: async (key: string): Promise<{ size: number } | null> => {
    try {
      const res = await getClient().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
      return { size: res.ContentLength ?? 0 };
    } catch (err) {
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return null;
      throw err;
    }
  },

  deleteObject: async (key: string): Promise<void> => {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
  },
};
