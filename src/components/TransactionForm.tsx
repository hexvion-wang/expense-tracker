import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Category, Transaction } from '../lib/types'
import { parseAmount, toLocalInput } from '../lib/money'
import { deleteTransaction, saveTransaction } from '../lib/api'

interface Props {
  categories: Category[]
  editing: Transaction | null // null = 新增
  onDone: () => void
  onCancel: () => void
}

export default function TransactionForm({ categories, editing, onDone, onCancel }: Props) {
  const [amount, setAmount] = useState(editing?.amount != null ? String(editing.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? categories[0]?.id ?? null)
  const [merchant, setMerchant] = useState(editing?.merchant ?? '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [when, setWhen] = useState(toLocalInput(editing?.occurred_at ?? new Date().toISOString()))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        category_id: categoryId,
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

        {editing?.raw_text && <p className="raw">原始內容：{editing.raw_text}</p>}

        <label className="field">
          <span className="label">金額（NT$）</span>
          <input className="amount-input" inputMode="decimal" autoFocus={!editing} placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>

        <div className="field">
          <span className="label">分類</span>
          <div className="chips">
            {categories.map((c) => (
              <button type="button" key={c.id} aria-pressed={c.id === categoryId}
                className={`chip${c.id === categoryId ? ' selected' : ''}`} onClick={() => setCategoryId(c.id)}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span className="label">商家（選填）</span>
          <input value={merchant} maxLength={200} onChange={(e) => setMerchant(e.target.value)} placeholder="例如：全家、Anthropic" />
        </label>
        <label className="field">
          <span className="label">備註（選填）</span>
          <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
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
