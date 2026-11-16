import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Account, AccountType } from '../lib/types'
import { ACCOUNT_TYPES } from '../lib/types'
import { formatTWD } from '../lib/money'
import { addAdjustment, deleteAccount, saveAccount } from '../lib/api'
import { hasLongNumber, SENSITIVE_HINT } from '../lib/sensitive'

interface Props { accounts: Account[]; onChanged: () => void }

export default function AssetsPage({ accounts, onChanged }: Props) {
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [adjusting, setAdjusting] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const active = accounts.filter((a) => !a.archived)
  const assets = active.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0)
  const debts = active.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0)
  const visible = showArchived ? accounts : active
  const done = () => { setEditing(null); setAdjusting(null); onChanged() }

  return (
    <>
      <section className="card">
        <p className="label">淨資產</p>
        <p className="total">{formatTWD(assets + debts)}</p>
        <div className="split">
          <div><p className="label small">資產</p><p className="num">{formatTWD(assets)}</p></div>
          <div><p className="label small">負債</p><p className="num">{formatTWD(-debts)}</p></div>
        </div>
      </section>

      <div className="row-between section-head">
        <h2>帳戶</h2>
        <button className="link" onClick={() => setEditing('new')}>＋ 新增帳戶</button>
      </div>

      {visible.length === 0 ? (
        <p className="empty">還沒有帳戶。新增你的銀行、信用卡、LINE Pay 或現金吧！</p>
      ) : (
        (Object.keys(ACCOUNT_TYPES) as AccountType[]).map((type) => {
          const list = visible.filter((a) => a.type === type)
          if (list.length === 0) return null
          return (
            <section key={type} className="day-group">
              <h3 className="day">{ACCOUNT_TYPES[type].label}<span>{formatTWD(list.filter((a) => !a.archived).reduce((s, a) => s + a.balance, 0))}</span></h3>
              <ul className="tx-list">
                {list.map((a) => (
                  <li key={a.id} className="account-row">
                    <button className="tx" onClick={() => setEditing(a)}>
                      <span className="tx-icon" aria-hidden>{ACCOUNT_TYPES[a.type].icon}</span>
                      <span className="tx-main">
                        <span className="tx-title">{a.name}{a.archived && '（已封存）'}</span>
                        <span className="tx-sub">{[a.institution, a.last4 && `末四碼 ${a.last4}`].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className={`tx-amount${a.balance < 0 ? ' neg' : ''}`}>{formatTWD(a.balance)}</span>
                    </button>
                    <button className="adjust-btn" onClick={() => setAdjusting(a)}>校正</button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
      {accounts.some((a) => a.archived) && (
        <button className="link" onClick={() => setShowArchived(!showArchived)}>{showArchived ? '隱藏已封存帳戶' : '顯示已封存帳戶'}</button>
      )}
      <p className="muted small note-box">
        🔐 只存帳戶暱稱、末 4 碼與餘額。<strong>不要</strong>輸入完整帳號、卡號、有效期限、CVV 或任何密碼。
      </p>

      {editing && <AccountForm account={editing === 'new' ? null : editing} nextOrder={accounts.length} onCancel={() => setEditing(null)} onDone={done} />}
      {adjusting && <AdjustForm account={adjusting} onCancel={() => setAdjusting(null)} onDone={done} />}
    </>
  )
}

function parseSigned(input: string): number | null {
  const s = input.replace(/[,\s]/g, '')
  return /^-?\d{1,12}(\.\d{1,2})?$/.test(s) ? Number(s) : null
}

function AccountForm({ account, nextOrder, onCancel, onDone }: {
  account: Account | null; nextOrder: number; onCancel: () => void; onDone: () => void
}) {
  const [name, setName] = useState(account?.name ?? '')
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank')
  const [institution, setInstitution] = useState(account?.institution ?? '')
  const [last4, setLast4] = useState(account?.last4 ?? '')
  const [opening, setOpening] = useState(account ? String(account.opening_balance) : '')
  const [note, setNote] = useState(account?.note ?? '')
  const [archived, setArchived] = useState(account?.archived ?? false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('請輸入帳戶名稱')
    if ([name, institution, note].some(hasLongNumber)) return setError(SENSITIVE_HINT)
    if (last4 && !/^\d{4}$/.test(last4)) return setError('末四碼請輸入 4 個數字，或留空')
    const ob = opening.trim() ? parseSigned(opening) : 0
    if (ob == null) return setError('期初餘額請輸入數字（信用卡欠款可輸入負數）')
    setBusy(true)
    try {
      await saveAccount({
        name: name.trim(), type, institution: institution.trim() || null, last4: last4 || null,
        opening_balance: ob, note: note.trim() || null, archived,
      }, account?.id, nextOrder)
      onDone()
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  async function remove() {
    if (!account || !confirm(`刪除「${account.name}」？\n相關的支出紀錄會保留，但不再連結到這個帳戶；餘額校正紀錄會一併刪除。\n\n如果只是不再使用，建議改用「封存」。`)) return
    setBusy(true)
    try { await deleteAccount(account.id); onDone() } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button type="button" className="link" onClick={onCancel}>取消</button>
          <h2>{account ? '編輯帳戶' : '新增帳戶'}</h2>
          <button className="link strong" disabled={busy}>儲存</button>
        </div>
        <div className="field">
          <span className="label">類型</span>
          <div className="chips">
            {(Object.entries(ACCOUNT_TYPES) as [AccountType, { label: string; icon: string }][]).map(([key, t]) => (
              <button type="button" key={key} aria-pressed={type === key} className={`chip${type === key ? ' selected' : ''}`} onClick={() => setType(key)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">
          <span className="label">名稱</span>
          <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="例如：國泰活存、LINE Pay Money" />
        </label>
        <div className="row">
          <label className="field grow">
            <span className="label">機構（選填）</span>
            <input value={institution} maxLength={50} onChange={(e) => setInstitution(e.target.value)} placeholder="例如：國泰世華" />
          </label>
          <label className="field last4-field">
            <span className="label">末四碼</span>
            <input inputMode="numeric" value={last4} maxLength={4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} placeholder="選填" />
          </label>
        </div>
        <label className="field">
          <span className="label">期初餘額（NT$）{type === 'credit_card' && '— 信用卡未繳金額請填負數'}</span>
          <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
        </label>
        <label className="field">
          <span className="label">備註（選填）</span>
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="例如：結帳日 每月 5 號" />
        </label>
        {account && (
          <label className="check">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
            封存（不再顯示於選單與淨資產，但保留紀錄）
          </label>
        )}
        <p className="muted small">🔐 請勿輸入完整帳號、卡號、CVV 或密碼。</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>儲存</button>
        {account && <button type="button" className="danger" disabled={busy} onClick={remove}>刪除這個帳戶</button>}
      </form>
    </div>
  )
}

function AdjustForm({ account, onCancel, onDone }: { account: Account; onCancel: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'set' | 'delta'>('set')
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const n = parseSigned(value)
  const delta = n == null ? null : mode === 'set' ? Math.round((n - account.balance) * 100) / 100 : n

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (delta == null) return setError('請輸入數字')
    if (delta === 0) return onCancel()
    if (hasLongNumber(note)) return setError(SENSITIVE_HINT)
    setBusy(true)
    try {
      await addAdjustment(account.id, delta, note.trim() || (mode === 'set' ? '對帳校正' : null))
      onDone()
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button type="button" className="link" onClick={onCancel}>取消</button>
          <h2>校正「{account.name}」</h2>
          <button className="link strong" disabled={busy}>儲存</button>
        </div>
        <p className="muted">目前 App 計算的餘額：<strong>{formatTWD(account.balance)}</strong></p>
        <div className="chips field">
          <button type="button" aria-pressed={mode === 'set'} className={`chip${mode === 'set' ? ' selected' : ''}`} onClick={() => setMode('set')}>設定實際餘額</button>
          <button type="button" aria-pressed={mode === 'delta'} className={`chip${mode === 'delta' ? ' selected' : ''}`} onClick={() => setMode('delta')}>增加／減少</button>
        </div>
        <label className="field">
          <span className="label">{mode === 'set' ? '銀行 App 上顯示的實際餘額' : '金額（增加填正數、減少填負數）'}</span>
          <input className="amount-input" inputMode="decimal" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          {delta != null && delta !== 0 && <span className="hint">將{delta > 0 ? '增加' : '減少'} {formatTWD(Math.abs(delta))}，校正後餘額 {formatTWD(account.balance + delta)}</span>}
        </label>
        <label className="field">
          <span className="label">說明（選填）</span>
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'set' ? '對帳校正' : '例如：薪水入帳、繳卡費'} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>儲存</button>
      </form>
    </div>
  )
}
