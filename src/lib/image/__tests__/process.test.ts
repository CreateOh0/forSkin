import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { processImage } from '../process'

async function makeTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 150, b: 100 },
    },
  })
    .jpeg()
    .toBuffer()
}

describe('processImage', () => {
  it('returns original and thumbnail buffers', async () => {
    const input = await makeTestImage(800, 600)
    const result = await processImage(input)
    expect(result.original).toBeInstanceOf(Buffer)
    expect(result.thumbnail).toBeInstanceOf(Buffer)
    expect(result.original.length).toBeGreaterThan(0)
    expect(result.thumbnail.length).toBeGreaterThan(0)
  })

  it('thumbnail is exactly 400x400', async () => {
    const input = await makeTestImage(800, 600)
    const { thumbnail } = await processImage(input)
    const meta = await sharp(thumbnail).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(400)
  })

  it('does not upscale original smaller than 1920px', async () => {
    const input = await makeTestImage(200, 200)
    const { original } = await processImage(input)
    const meta = await sharp(original).metadata()
    expect(meta.width).toBeLessThanOrEqual(200)
  })

  it('original is JPEG format', async () => {
    const input = await makeTestImage(400, 400)
    const { original } = await processImage(input)
    const meta = await sharp(original).metadata()
    expect(meta.format).toBe('jpeg')
  })
})
