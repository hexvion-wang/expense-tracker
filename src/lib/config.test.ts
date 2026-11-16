import { describe, expect, it } from 'vitest'
import { isSecretKey, readConfig } from './config'

const jwt = (role: string) => `x.${btoa(JSON.stringify({ role }))}.y`

describe('readConfig', () => {
  it('缺少設定時回傳 null', () => {
    expect(readConfig({})).toBeNull()
    expect(readConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toBeNull()
  })

  it('接受正確的 URL 與公開金鑰', () => {
    expect(readConfig({ VITE_SUPABASE_URL: 'https://abc123.supabase.co/', VITE_SUPABASE_ANON_KEY: 'sb_publishable_xyz' }))
      .toEqual({ url: 'https://abc123.supabase.co', key: 'sb_publishable_xyz' })
  })

  it('網址結尾多了 /rest/v1/ 也能用', () => {
    expect(readConfig({ VITE_SUPABASE_URL: 'https://abc123.supabase.co/rest/v1/', VITE_SUPABASE_ANON_KEY: 'k' }))
      .toEqual({ url: 'https://abc123.supabase.co', key: 'k' })
  })

  it('拒絕不是 Supabase 的網址', () => {
    expect(readConfig({ VITE_SUPABASE_URL: 'http://evil.example.com', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
    expect(readConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co.evil.com', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
  })

  it('誤填 secret key 時直接報錯', () => {
    expect(() => readConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_secret_abc' })).toThrow()
    expect(() => readConfig({ VITE_SUPABASE_URL: 'https://abc.supabase.co', VITE_SUPABASE_ANON_KEY: jwt('service_role') })).toThrow()
  })
})

describe('isSecretKey', () => {
  it('anon JWT 不是 secret', () => {
    expect(isSecretKey(jwt('anon'))).toBe(false)
  })
})
