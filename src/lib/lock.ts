// App 鎖：用 iPhone 的 Face ID / Touch ID（透過 WebAuthn「通行密鑰」）在打開 App 時確認是本人。
// 注意：這是「裝置上的門鎖」，防止拿到你已解鎖手機的人直接看到資料；
// 資料庫本身的安全仍然靠登入密碼與 RLS。
import { getItem, setItem } from './storage'

const KEY = 'app-lock'

export interface LockSettings {
  credentialId: string // base64url
  afterMinutes: number // 離開 App 多久後要重新解鎖（0 = 立即）
}

export function getLockSettings(): LockSettings | null {
  try {
    const v = JSON.parse(getItem(KEY) ?? 'null')
    return v && typeof v.credentialId === 'string' && typeof v.afterMinutes === 'number' ? v : null
  } catch { return null }
}

export function setLockSettings(s: LockSettings | null): void {
  setItem(KEY, s ? JSON.stringify(s) : null)
}

export async function isLockSupported(): Promise<boolean> {
  try {
    return !!window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch { return false }
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))
const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/** 建立一把只存在這支手機（及你的 iCloud 鑰匙圈）的通行密鑰，建立時會要求 Face ID */
export async function enableLock(label: string, afterMinutes: number): Promise<void> {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: '我的記帳本' },
      user: { id: random(16), name: label, displayName: '記帳 App 鎖' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null
  if (!cred) throw new Error('沒有建立成功')
  setLockSettings({ credentialId: toB64(cred.rawId), afterMinutes })
}

/** 跳出 Face ID；成功且確實有驗證本人（UV 旗標）才回傳 true */
export async function unlock(settings: LockSettings): Promise<boolean> {
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: random(32),
      allowCredentials: [{ type: 'public-key', id: fromB64(settings.credentialId) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null
  if (!cred) return false
  const authData = new Uint8Array((cred.response as AuthenticatorAssertionResponse).authenticatorData)
  return (authData[32] & 0x04) !== 0 // UV = 使用者已通過生物辨識或密碼驗證
}
