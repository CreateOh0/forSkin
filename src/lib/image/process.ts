import sharp from 'sharp'

export interface ProcessedImage {
  original: Buffer  // JPEG ≤1920×1920, quality 85 — for AI analysis
  thumbnail: Buffer // JPEG 400×400 cover crop — for dashboard display
}

export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const [original, thumbnail] = await Promise.all([
    sharp(input)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer(),
    sharp(input)
      .resize(400, 400, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 70 })
      .toBuffer(),
  ])
  return { original, thumbnail }
}
