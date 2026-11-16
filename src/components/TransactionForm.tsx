import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Account, Category, Rule, Transaction } from '../lib/types'
import { ACCOUNT_TYPES } from '../lib/types'
import { parseAmount, toLocalInput } from '../lib/money'
import { deleteTransaction, saveTransaction } from '../lib/api'
import { findRule } from '../lib/rules'

interface Props {
  categories: Category[]
  accounts: Account[]
  rules: Rule[]
  editing: Transaction | null // null = 新增
  onDone: () => void
  onCancel: () => void
}

export default function TransactionForm({ categories, accounts, rules, editing, onDone, onCancel }: Props) {
  const [amount, setAmount] = useState(editing?.amount != null ? String(editing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null)
  const [accountId, setAccountId] = useState<string | null>(editing?.account_id ?? null)
  const [merchant, setMerchant] = useState(editing?.merchant ?? '')
  // 系統提示（⚠️ 開頭）只顯示、不當成備註儲存
  const systemHint = editing?.note?.startsWith('⚠️') ? editing.note : null
  const [note, setNote] = useState(systemHint ? '' : editing?.note ?? '')
  const [when, setWhen] = useState(toLocalInput(editing?.occurred_at ?? new Date().toISOString()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 使用者自己點過的欄位，規則就不再覆蓋
  const [touched, setTouched] = useState({ category: !!editing?.category_id, account: !!editing?.account_id, note: !!editing?.note && !systemHint })
  const [ruleHint, setRuleHint] = useState<string | null>(null)
  const activeAccounts = accounts.filter((a) => !a.archived || a.id === accountId)

  function onMerchantChange(value: string) {
    setMerchant(value)
    const r = findRule(rules, value)
    if (!r) { setRuleHint(null); return }
    const cat = categories.find((c) => c.id === r.category_id)
    if (!touched.category) setCategoryId(r.category_id)
    if (!touched.account && r.account_id) setAccountId(r.account_id)
    if (!touched.note && r.note_template) setNote(r.note_template)
    setRuleHint(`已套用規則「${r.pattern}」→ ${cat?.icon ?? ''} ${cat?.name ?? ''}`)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = parseAmount(amount)
    if (value == null) return setError('請輸入大於 0 的金額，最多兩位小數')
    if (!when) return setError('請選擇日期時間')
    setBusy(true)
    setError(null)
    try {
      await saveTransaction({
        amount: value,
        category_id: categoryId ?? categories.find((c) => c.name === '其他')?.id ?? null,
        account_id: accountId,
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        occurred_at: new Date(when).toISOString(),
      }, editing?.id)
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!editing || !confirm('確定要刪除這筆紀錄嗎？')) return
    setBusy(true)
    try {
      await deleteTransaction(editing.id)
      onDone()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button type="button" className="link" onClick={onCancel}>取消</button>
          <h2>{editing ? '編輯紀錄' : '新增支出'}</h2>
          <button className="link strong" disabled={busy}>儲存</button>
        </div>

        {systemHint && <p className="warn small">{systemHint}</p>}
        {editing?.raw_text && <p className="raw">原始內容：{editing.raw_text}</p>}

        <label className="field">
          <span className="label">金額（NT$）</span>
          <input className="amount-input" inputMode="decimal" autoFocus={!editing} placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <label className="field">
          <span className="label">商家（選填，會自動套用規則）</span>
          <input value={merchant} maxLength={200} onChange={(e) => onMerchantChange(e.target.value)} placeholder="例如：全家、Anthropic" />
          {ruleHint && <span className="hint">✨ {ruleHint}</span>}
        </label>

        <div className="field">
          <span className="label">分類{!categoryId && '（未選擇時歸到「其他」）'}</span>
          <div className="chips">
            {categories.map((c) => (
              <button type="button" key={c.id} aria-pressed={c.id === categoryId}
                className={`chip${c.id === categoryId ? ' selected' : ''}`}
                onClick={() => { setCategoryId(c.id); setTouched((t) => ({ ...t, category: true })) }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>

        {activeAccounts.length > 0 && (
          <div className="field">
            <span className="label">付款帳戶（選填，會自動扣餘額）</span>
            <div className="chips">
              <button type="button" aria-pressed={accountId == null} className={`chip${accountId == null ? ' selected' : ''}`}
                onClick={() => { setAccountId(null); setTouched((t) => ({ ...t, account: true })) }}>不指定</button>
              {activeAccounts.map((a) => (
                <button type="button" key={a.id} aria-pressed={a.id === accountId}
                  className={`chip${a.id === accountId ? ' selected' : ''}`}
                  onClick={() => { setAccountId(a.id); setTouched((t) => ({ ...t, account: true })) }}>
                  {ACCOUNT_TYPES[a.type].icon} {a.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span className="label">備註（選填）</span>
          <input value={note} maxLength={500} onChange={(e) => { setNote(e.target.value); setTouched((t) => ({ ...t, note: true })) }} />
        </label>
        <label className="field">
          <span className="label">日期時間</span>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>

        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? '儲存中…' : '儲存'}</button>
        {editing && <button type="button" className="danger" disabled={busy} onClick={remove}>刪除這筆紀錄</button>}
      </form>
    </div>
  )
}
