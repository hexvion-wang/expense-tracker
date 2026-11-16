import { describe, expect, it } from 'vitest'
import { byCategory, monthlyTotals, total } from './report'
import type { Category, Transaction } from './types'

const cats: Category[] = [
  { id: 'food', name: '餐飲', icon: '🍱', monthly_budget: 5000, sort_order: 0 },
  { id: 'sub', name: '訂閱服務', icon: '🔁', monthly_budget: null, sort_order: 1 },
]
let n = 0
const tx = (amount: number | null, category_id: string | null, occurred_at = '2026-11-10T04:00:00Z', status: Transaction['status'] = 'confirmed'): Transaction =>
  ({ id: String(n++), amount, currency: 'TWD', merchant: null, note: null, category_id, source: 'manual', status, raw_text: null, occurred_at })

describe('total', () => {
  it('不計入待確認或沒有金額的交易', () => {
    expect(total([tx(100, 'food'), tx(50, null), tx(null, null, undefined, 'pending'), tx(999, 'food', undefined, 'pending')])).toBe(150)
  })
})

describe('byCategory', () => {
  it('依金額排序，找不到的分類歸到未分類', () => {
    const r = byCategory([tx(100, 'food'), tx(700, 'sub'), tx(30, null), tx(20, 'deleted')], cats)
    expect(r.map((x) => [x.name, x.amount])).toEqual([['訂閱服務', 700], ['餐飲', 100], ['未分類', 50]])
    expect(r[1].budget).toBe(5000)
  })
})

describe('monthlyTotals', () => {
  it('回傳最近 n 個月，包含沒有支出的月份', () => {
    const r = monthlyTotals([tx(100, 'food', '2026-11-10T04:00:00Z'), tx(40, 'food', '2026-09-10T04:00:00Z')], { year: 2026, month: 11 }, 3)
    expect(r.map((x) => [x.month.month, x.amount])).toEqual([[9, 40], [10, 0], [11, 100]])
  })
})
