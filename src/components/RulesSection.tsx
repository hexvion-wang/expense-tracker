import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Account, Category, Rule } from '../lib/types'
import { ACCOUNT_TYPES } from '../lib/types'
import { applyRulesToUncategorized, deleteRule, saveRule } from '../lib/api'
import { validatePattern } from '../lib/rules'

interface Props { rules: Rule[]; categories: Category[]; accounts: Account[]; onChanged: () => void }

export default function RulesSection({ rules, categories, accounts, onChanged }: Props) {
  const [editing, setEditing] = useState<Rule | 'new' | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function applyAll() {
    setBusy(true)
    setStatus(null)
    try {
      const n = await applyRulesToUncategorized(rules)
      setStatus(n ? `已更新 ${n} 筆未分類紀錄` : '沒有符合規則的未分類紀錄')
      onChanged()
    } catch (e) { setStatus(`失敗：${(e as Error).message}`) }
    setBusy(false)
  }

  return (
    <section className="card">
      <div className="row-between">
        <h2>自動分類規則</h2>
        <button className="link" onClick={() => setEditing('new')}>＋ 新增規則</button>
      </div>
      <p className="muted small">商家名稱符合規則時，自動帶入分類、帳戶與備註。</p>
      {rules.length === 0 ? (
        <p className="muted">還沒有規則。例如：商家包含「Anthropic」→ 訂閱服務，備註「Claude AI 月費」。</p>
      ) : (
        <ul className="plain-list">
          {rules.map((r) => {
            const c = categories.find((x) => x.id === r.category_id)
            const a = accounts.find((x) => x.id === r.account_id)
            return (
              <li key={r.id}>
                <button className={`tx${r.enabled ? '' : ' disabled'}`} onClick={() => setEditing(r)}>
                  <span className="tx-icon" aria-hidden>{c?.icon ?? '❔'}</span>
                  <span className="tx-main">
                    <span className="tx-title">{r.match_type === 'regex' ? '符合' : '包含'}「{r.pattern}」{!r.enabled && '（停用）'}</span>
                    <span className="tx-sub">→ {c?.name ?? '未分類'}{a ? ` · ${a.name}` : ''}{r.note_template ? ` · ${r.note_template}` : ''}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {rules.length > 0 && <button className="link" disabled={busy} onClick={applyAll}>{busy ? '套用中…' : '套用到所有「未分類」紀錄'}</button>}
      {status && <p className="muted small" role="status">{status}</p>}
      {editing && (
        <RuleForm rule={editing === 'new' ? null : editing} categories={categories} accounts={accounts}
          onCancel={() => setEditing(null)} onDone={() => { setEditing(null); onChanged() }} />
      )}
    </section>
  )
}

function RuleForm({ rule, categories, accounts, onCancel, onDone }: {
  rule: Rule | null; categories: Category[]; accounts: Account[]; onCancel: () => void; onDone: () => void
}) {
  const [pattern, setPattern] = useState(rule?.pattern ?? '')
  const [matchType, setMatchType] = useState<Rule['match_type']>(rule?.match_type ?? 'contains')
  const [categoryId, setCategoryId] = useState(rule?.category_id ?? categories[0]?.id ?? '')
  const [accountId, setAccountId] = useState<string | null>(rule?.account_id ?? null)
  const [note, setNote] = useState(rule?.note_template ?? '')
  const [priority, setPriority] = useState(String(rule?.priority ?? 0))
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const err = validatePattern(matchType, pattern)
    if (err) return setError(err)
    if (!categoryId) return setError('請選擇分類')
    const p = Number(priority)
    if (!Number.isInteger(p) || Math.abs(p) > 1000) return setError('優先順序請輸入 -1000 到 1000 的整數')
    setBusy(true)
    try {
      await saveRule({ pattern: pattern.trim(), match_type: matchType, category_id: categoryId, account_id: accountId,
        note_template: note.trim() || null, priority: p, enabled }, rule?.id)
      onDone()
    } catch (e2) { setError((e2 as Error).message); setBusy(false) }
  }

  async function remove() {
    if (!rule || !confirm('刪除這條規則？已經分類好的紀錄不會改變。')) return
    setBusy(true)
    try { await deleteRule(rule.id); onDone() } catch (e2) { setError((e2 as Error).message); setBusy(false) }
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button type="button" className="link" onClick={onCancel}>取消</button>
          <h2>{rule ? '編輯規則' : '新增規則'}</h2>
          <button className="link strong" disabled={busy}>儲存</button>
        </div>
        <label className="field">
          <span className="label">商家名稱包含（不分大小寫）</span>
          <input value={pattern} maxLength={200} autoFocus={!rule} onChange={(e) => setPattern(e.target.value)} placeholder="例如：Anthropic" />
        </label>
        <label className="check">
          <input type="checkbox" checked={matchType === 'regex'} onChange={(e) => setMatchType(e.target.checked ? 'regex' : 'contains')} />
          進階：使用正規表示式（例如 <code>7-?eleven|統一超商</code>）
        </label>
        <div className="field">
          <span className="label">歸到分類</span>
          <div className="chips">
            {categories.map((c) => (
              <button type="button" key={c.id} aria-pressed={c.id === categoryId} className={`chip${c.id === categoryId ? ' selected' : ''}`} onClick={() => setCategoryId(c.id)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>
        {accounts.length > 0 && (
          <div className="field">
            <span className="label">付款帳戶（選填）</span>
            <div className="chips">
              <button type="button" aria-pressed={accountId == null} className={`chip${accountId == null ? ' selected' : ''}`} onClick={() => setAccountId(null)}>不指定</button>
              {accounts.filter((a) => !a.archived).map((a) => (
                <button type="button" key={a.id} aria-pressed={a.id === accountId} className={`chip${a.id === accountId ? ' selected' : ''}`} onClick={() => setAccountId(a.id)}>
                  {ACCOUNT_TYPES[a.type].icon} {a.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="field">
          <span className="label">自動備註（選填）</span>
          <input value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="例如：Claude AI 月費" />
        </label>
        <label className="field">
          <span className="label">優先順序（數字大的先比對，預設 0）</span>
          <input inputMode="numeric" value={priority} onChange={(e) => setPriority(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> 啟用這條規則
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>儲存</button>
        {rule && <button type="button" className="danger" disabled={busy} onClick={remove}>刪除這條規則</button>}
      </form>
    </div>
  )
}
