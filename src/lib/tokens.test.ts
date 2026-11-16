import { describe, expect, it } from 'vitest'
import { generateToken, sha256Hex } from './tokens'

describe('tokens', () => {
  it('產生 46 字元、每次不同的 token', () => {
    const a = generateToken(), b = generateToken()
    expect(a).toMatch(/^et_[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
  })
  it('SHA-256 與資料庫 encode(digest(x, sha256), hex) 相同', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})
