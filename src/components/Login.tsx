import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// 使用 Email + 密碼登入。帳號由本人在 Supabase 後台建立（Authentication → Users → Add user），
// App 本身不提供註冊功能，別人就算知道網址也無法建立帳號。
export default function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function signIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setMessage(error.message === 'Invalid login credentials' ? 'Email 或密碼錯誤' : `登入失敗：${error.message}`)
  }

  return (
    <section className="card">
      <h2>登入</h2>
      <form onSubmit={signIn}>
        <label className="field">
          <span className="label">Email</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span className="label">密碼</span>
          <input type="password" required autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="primary" disabled={busy}>{busy ? '登入中…' : '登入'}</button>
      </form>
      {message && <p className="muted" role="status">{message}</p>}
    </section>
  )
}
