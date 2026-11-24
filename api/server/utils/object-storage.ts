import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

export function getObjectStorage() {
  const config = useRuntimeConfig().storage
  if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) throw createError({ statusCode: 503, message: '图片存储尚未配置，请联系管理员' })
  const client = new S3Client({
    region: config.region,
    endpoint: config.endpoint || undefined,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    requestHandler: { connectionTimeout: 5000, requestTimeout: 30000 },
    maxAttempts: 2
  })
  return {
    async put(key: string, body: Buffer) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: 'image/webp' }))
    },
    async get(key: string) {
      return client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }))
    },
    async remove(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
    }
  }
}
