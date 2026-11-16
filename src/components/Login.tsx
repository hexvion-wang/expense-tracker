import { useState } from 'react'
import type { FormEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

// 用「Email 驗證碼」登入，而不是點信中的連結：
// iPhone 主畫面的 App 和 Safari 是分開的，點信中連結會在 Safari 登入，主畫面 App 仍是登出狀態。
export default function Login({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await client.auth.signInWithOtp({ email: email.trim() })
    setBusy(false)
    if (error) return setMessage(`寄送失敗：${error.message}`)
    setStep('code')
    setMessage('驗證碼已寄出，請到信箱查看。')
  }

  async function verify(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) setMessage(`驗證失敗：${error.message}`)
  }

  return (
    <section className="card">
      <h2>登入</h2>
      {step === 'email' ? (
        <form onSubmit={sendCode}>
          <label className="field">
            <span className="label">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="primary" disabled={busy}>{busy ? '寄送中…' : '寄送驗證碼'}</button>
        </form>
      ) : (
        <form onSubmit={verify}>
          <label className="field">
            <span className="label">驗證碼（寄到 {email}）</span>
            <input inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6,10}"
              value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="primary" disabled={busy}>{busy ? '驗證中…' : '登入'}</button>
          <button type="button" className="link" onClick={() => { setStep('email'); setCode(''); setMessage(null) }}>
            換一個 Email
          </button>
        </form>
      )}
      {message && <p className="muted" role="status">{message}</p>}
    </section>
  )
}
