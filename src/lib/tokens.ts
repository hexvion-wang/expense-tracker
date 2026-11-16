// 捷徑 token：在手機上產生，只把 SHA-256 雜湊存進資料庫；原始 token 只顯示一次
export function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return 'et_' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
