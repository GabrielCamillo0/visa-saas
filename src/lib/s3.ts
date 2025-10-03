import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/lib/env';


export const s3 = new S3Client({
region: env.S3_REGION || 'us-east-1',
endpoint: env.S3_ENDPOINT, // use MinIO/R2 passando endpoint
forcePathStyle: !!env.S3_ENDPOINT, // necessário p/ MinIO
credentials: env.S3_ACCESS_KEY && env.S3_SECRET_KEY ? {
accessKeyId: env.S3_ACCESS_KEY,
secretAccessKey: env.S3_SECRET_KEY,
} : undefined,
});


export async function getSignedUploadUrl(path: string, contentType = 'application/octet-stream') {
if (!env.S3_BUCKET) throw new Error('S3_BUCKET ausente nas envs');
const Bucket = env.S3_BUCKET;
const Key = path.startsWith('/') ? path.slice(1) : path;
const cmd = new PutObjectCommand({ Bucket, Key, ContentType: contentType });
const url = await getSignedUrl(s3, cmd, { expiresIn: 15 * 60 });


const publicUrl = env.S3_ENDPOINT
? `${env.S3_ENDPOINT.replace(/\/$/, '')}/${Bucket}/${Key}`
: `https://${Bucket}.s3.${env.S3_REGION || 'us-east-1'}.amazonaws.com/${Key}`;


return { url, publicUrl, bucket: Bucket, key: Key, contentType };
}