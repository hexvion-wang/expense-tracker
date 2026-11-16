import { useEffect, useState } from 'react'
import { config } from '../lib/supabase'
import { createToken, listTokens, revokeToken, type IngestToken } from '../lib/api'

const GUIDE = 'https://github.com/hexvion-wang/expense-tracker/blob/main/shortcuts/README.md'

function CopyRow({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* 忽略 */ }
  }
  return (
    <div className={`copy-row${secret ? ' secret' : ''}`}>
      <span className="label small">{label}</span>
      <code className="copy-value">{value}</code>
      <button type="button" className="link" onClick={copy}>{copied ? '已複製 ✓' : '複製'}</button>
    </div>
  )
}

export default function ShortcutSection() {
  const [tokens, setTokens] = useState<IngestToken[]>([])
  const [newToken, setNewToken] = useState<string | null>(null)
  const [label, setLabel] = useState('iPhone 捷徑')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => listTokens().then(setTokens).catch((e: Error) => setError(e.message))
  useEffect(() => { load() }, [])
  if (!config) return null
  const endpoint = `${config.url}/rest/v1/rpc/ingest`

  async function create() {
    setBusy(true); setError(null)
    try { setNewToken(await createToken(label.trim() || 'iPhone 捷徑')); await load() } catch (e) { setError((e as Error).message) }
    setBusy(false)
  }

  async function revoke(t: IngestToken) {
    if (!confirm(`撤銷「${t.label}」？使用這個 token 的捷徑會立刻失效。`)) return
    try { await revokeToken(t.id); await load() } catch (e) { setError((e as Error).message) }
  }

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' }) : '從未使用')

  return (
    <section className="card">
      <h2>捷徑自動記帳</h2>
      <p className="muted small">iPhone 捷徑會把 Apple Pay、銀行簡訊或截圖文字送進來，打開 App 時自動辨識金額、商家並套用規則。
        <a href={GUIDE} target="_blank" rel="noreferrer"> 設定教學 ↗</a></p>

      <h3 className="sub">① 捷徑要填的設定值（公開值）</h3>
      <CopyRow label="網址" value={endpoint} />
      <CopyRow label="apikey" value={config.key} />

      <h3 className="sub">② 捷徑專用 token（秘密）</h3>
      {newToken ? (
        <div className="token-box">
          <p className="warn small"><strong>⚠️ 這個 token 只會顯示這一次。</strong>現在複製並貼到捷徑裡，之後就看不到了。</p>
          <CopyRow label="token" value={newToken} secret />
          <p className="muted small">🔐 不要傳給任何人、不要貼到對話或 GitHub。分享捷徑給別人時，token 也會跟著被分享出去。</p>
          <button className="secondary" onClick={() => setNewToken(null)}>我已經貼到捷徑了</button>
        </div>
      ) : (
        <div className="row">
          <input className="grow" value={label} maxLength={50} onChange={(e) => setLabel(e.target.value)} aria-label="token 名稱" />
          <button className="secondary fit" disabled={busy} onClick={create}>產生 token</button>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="plain-list">
          {tokens.map((t) => (
            <li key={t.id} className="row-between token-item">
              <span>
                <span>{t.label}</span>
                <span className="muted small block">建立 {fmt(t.created_at)} · 最後使用 {fmt(t.last_used_at)}</span>
              </span>
              <button className="link danger-text" onClick={() => revoke(t)}>撤銷</button>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">懷疑 token 外洩（例如手機遺失、捷徑分享給別人）時，請立刻撤銷並產生新的。token 只能新增待確認紀錄，無法讀取你的任何資料。</p>
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
