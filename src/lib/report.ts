import type { Category, Transaction } from './types'
import { addMonths, type Month } from './money'

const counted = (t: Transaction) => t.status === 'confirmed' && t.amount != null

export function total(txs: Transaction[]): number {
  return txs.filter(counted).reduce((s, t) => s + (t.amount ?? 0), 0)
}

export interface CategoryTotal {
  id: string | null
  name: string
  icon: string
  amount: number
  budget: number | null
}

/** 依分類加總，金額由大到小；沒有分類的歸到「未分類」 */
export function byCategory(txs: Transaction[], categories: Category[]): CategoryTotal[] {
  const map = new Map<string | null, number>()
  for (const t of txs.filter(counted)) {
    const key = categories.some((c) => c.id === t.category_id) ? t.category_id : null
    map.set(key, (map.get(key) ?? 0) + (t.amount ?? 0))
  }
  return [...map.entries()]
    .map(([id, amount]) => {
      const c = categories.find((x) => x.id === id)
      return { id, amount, name: c?.name ?? '未分類', icon: c?.icon ?? '❔', budget: c?.monthly_budget ?? null }
    })
    .sort((a, b) => b.amount - a.amount)
}

/** 最近 n 個月（含 end 當月）每月總額，舊到新 */
export function monthlyTotals(txs: Transaction[], end: Month, n: number): { month: Month; amount: number }[] {
  const months = Array.from({ length: n }, (_, i) => addMonths(end, i - (n - 1)))
  return months.map((m) => ({
    month: m,
    amount: total(txs.filter((t) => {
      const d = new Date(t.occurred_at)
      return d.getFullYear() === m.year && d.getMonth() + 1 === m.month
    })),
  }))
}

/** 依日期分組（本地時區），新到舊 */
export function groupByDay(txs: Transaction[]): { day: string; items: Transaction[] }[] {
  const sorted = [...txs].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
  const groups: { day: string; items: Transaction[] }[] = []
  for (const t of sorted) {
    const day = new Date(t.occurred_at).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric', weekday: 'short' })
    const last = groups[groups.length - 1]
    if (last?.day === day) last.items.push(t)
    else groups.push({ day, items: [t] })
  }
  return groups
}
