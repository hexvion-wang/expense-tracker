import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Category } from '../lib/types'
import { deleteCategory, saveCategory } from '../lib/api'
import { formatTWD, parseAmount } from '../lib/money'

interface Props {
  categories: Category[]
  onChanged: () => void
}

export default function CategoriesPage({ categories, onChanged }: Props) {
  const [editing, setEditing] = useState<Category | 'new' | null>(null)
  return (
    <>
      <section className="card">
        <div className="row-between">
          <h2>分類與預算</h2>
          <button className="link" onClick={() => setEditing('new')}>＋ 新增分類</button>
        </div>
        <ul className="plain-list">
          {categories.map((c) => (
            <li key={c.id}>
              <button className="tx" onClick={() => setEditing(c)}>
                <span className="tx-icon" aria-hidden>{c.icon}</span>
                <span className="tx-main"><span className="tx-title">{c.name}</span></span>
                <span className="muted small">{c.monthly_budget ? `預算 ${formatTWD(c.monthly_budget)}` : '未設預算'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {editing && (
        <CategoryForm category={editing === 'new' ? null : editing} nextOrder={categories.length}
          onCancel={() => setEditing(null)} onDone={() => { setEditing(null); onChanged() }} />
      )}
    </>
  )
}

function CategoryForm({ category, nextOrder, onCancel, onDone }: {
  category: Category | null; nextOrder: number; onCancel: () => void; onDone: () => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? '📦')
  const [budget, setBudget] = useState(category?.monthly_budget ? String(category.monthly_budget) : '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const b = budget.trim() ? parseAmount(budget) : null
    if (budget.trim() && b == null) return setError('預算請輸入大於 0 的數字，或留空')
    if (!name.trim()) return setError('請輸入名稱')
    setBusy(true)
    try {
      await saveCategory({ name: name.trim(), icon: icon.trim() || '📦', monthly_budget: b }, category?.id, nextOrder)
      onDone()
    } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  async function remove() {
    if (!category || !confirm(`刪除「${category.name}」？\n這個分類下的紀錄會保留，但變成「未分類」。`)) return
    setBusy(true)
    try { await deleteCategory(category.id); onDone() } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <form className="sheet" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <button type="button" className="link" onClick={onCancel}>取消</button>
          <h2>{category ? '編輯分類' : '新增分類'}</h2>
          <button className="link strong" disabled={busy}>儲存</button>
        </div>
        <div className="row">
          <label className="field icon-field">
            <span className="label">圖示</span>
            <input value={icon} maxLength={4} onChange={(e) => setIcon(e.target.value)} />
          </label>
          <label className="field grow">
            <span className="label">名稱</span>
            <input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} autoFocus={!category} />
          </label>
        </div>
        <label className="field">
          <span className="label">每月預算（選填，NT$）</span>
          <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="不設定" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>儲存</button>
        {category && <button type="button" className="danger" disabled={busy} onClick={remove}>刪除這個分類</button>}
      </form>
    </div>
  )
}
