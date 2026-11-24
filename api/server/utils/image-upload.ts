import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_UPLOAD_BYTES = MAX_IMAGE_BYTES + 64 * 1024
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class ImageUploadError extends Error {}

export async function normalizeImage(data: Buffer, mimeType: string) {
  if (!data.length || data.length > MAX_IMAGE_BYTES) throw new ImageUploadError('图片大小必须在 1 字节到 5 MiB 之间')
  if (!IMAGE_MIME_TYPES.includes(mimeType)) throw new ImageUploadError('仅支持 JPEG、PNG 和 WebP 图片')
  const image = sharp(data, { limitInputPixels: 25000000, animated: false, failOn: 'warning' })
  let metadata: sharp.Metadata
  try {
    metadata = await image.metadata()
  } catch {
    throw new ImageUploadError('无法读取图片，请上传有效的 JPEG、PNG 或 WebP 图片')
  }
  const formats: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
  if (!metadata.format || formats[metadata.format] !== mimeType || (metadata.pages ?? 1) > 1) throw new ImageUploadError('图片格式与文件类型不符，或包含不支持的动画')
  try {
    const { data: body, info } = await image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
    if (body.length > MAX_IMAGE_BYTES) throw new ImageUploadError('处理后的图片超过 5 MiB，请缩小图片后重试')
    return { body, width: info.width, height: info.height, contentType: 'image/webp' as const }
  } catch (error) {
    if (error instanceof ImageUploadError) throw error
    throw new ImageUploadError('图片解码失败，请重新导出图片后上传')
  }
}
