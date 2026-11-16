// Supabase 連線設定，建置時由環境變數注入：
// - 本機開發：寫在 .env.local（已列入 .gitignore，不會上傳）
// - GitHub Pages：寫在 repo 的 Settings → Secrets and variables → Actions → Variables
//
// 注意：這兩個值本來就會出現在網頁的 JavaScript 裡，是「公開」的。
// 資料安全靠的是資料庫的 RLS 規則，而不是把這兩個值藏起來。
// 絕對不要把 service_role / secret key 放在這裡！

export interface SupabaseConfig {
  url: string
  key: string
}

export function readConfig(env: Record<string, string | undefined>): SupabaseConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) return null
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) return null
  // 防呆：如果有人誤把 secret / service_role key 填進來，直接拒絕，避免它被發布到公開網站
  if (isSecretKey(key)) {
    throw new Error('偵測到 Supabase 的 secret / service_role key！這把金鑰絕不能放在網頁裡，請改用 anon / publishable key。')
  }
  return { url: url.replace(/\/$/, ''), key }
}

export function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true
  // 舊式 JWT 格式的金鑰：解開中間那段看 role
  const parts = key.split('.')
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      return payload.role === 'service_role'
    } catch {
      return false
    }
  }
  return false
}
