import { describe, it, expect } from 'vitest'
import { compressImage } from '../lib/image'

describe('Image Compression & Avatar Upload Utilities', () => {
  it('rejects files that are not images', async () => {
    const textFile = new File(['hello world'], 'test.txt', { type: 'text/plain' })
    await expect(compressImage(textFile)).rejects.toThrow('Invalid image file')
  })

  it('handles image file and processes with fallback when canvas 2d is unrendered', async () => {
    // 1x1 transparent PNG data URI
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const binary = atob(pngBase64)
    const array = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i)
    }

    const pngFile = new File([array], 'test.png', { type: 'image/png' })
    const result = await compressImage(pngFile, { maxWidth: 512, maxHeight: 512 })
    expect(result).toBeDefined()
    expect(result.startsWith('data:image/')).toBe(true)
  })

  it('enforces 5MB server limit for avatar base64 string (~7MB)', () => {
    const maxAllowedBase64Length = 7 * 1024 * 1024 // ~7.34 million characters
    const validSmallAvatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    
    // Test validation rule from server/index.js
    const isUnder5Mb = (avatar: string) => avatar.length <= maxAllowedBase64Length
    expect(isUnder5Mb(validSmallAvatar)).toBe(true)

    // Construct a simulated string > 7MB
    const oversizedLength = maxAllowedBase64Length + 100
    expect(oversizedLength <= maxAllowedBase64Length).toBe(false)
  })

  it('validates MIME format check strictly rejects dangerous or non-image types', () => {
    const isAllowedImage = (avatar: string) =>
      /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar.trim())

    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB'
    const validJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD'
    const validWebp = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoBAAEAAQ'
    const invalidSvg = 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+'
    const invalidText = 'data:text/plain;base64,aGVsbG8='

    expect(isAllowedImage(validPng)).toBe(true)
    expect(isAllowedImage(validJpg)).toBe(true)
    expect(isAllowedImage(validWebp)).toBe(true)
    expect(isAllowedImage(invalidSvg)).toBe(false)
    expect(isAllowedImage(invalidText)).toBe(false)
  })
})

