import { describe, expect, it } from 'vitest'
import { csvCell, makeBackup, transactionsToCsv } from './export'
import type { Transaction } from './types'

describe('csvCell', () => {
  it('跳脫逗號、引號、換行', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell(null)).toBe('')
    expect(csvCell(1234.5)).toBe('1234.5')
  })
  it('防止 CSV 公式注入', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`)
    expect(csvCell('+886')).toBe("'+886")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })
})

describe('transactionsToCsv', () => {
  it('產生含 BOM、標題列與中文欄位的 CSV', () => {
    const tx: Transaction = {
      id: '1', amount: 650, currency: 'TWD', merchant: 'Anthropic', note: 'Claude, 月費', category_id: 'sub',
      source: 'applepay', status: 'confirmed', raw_text: null, occurred_at: new Date(2026, 10, 5, 9, 7).toISOString(), account_id: 'card',
    }
    const csv = transactionsToCsv([tx], [{ id: 'sub', name: '訂閱服務', icon: '', monthly_budget: null, sort_order: 0 }],
      [{ id: 'card', name: '中信卡', type: 'credit_card' }])
    expect(csv.startsWith('﻿日期,時間,金額')).toBe(true)
    expect(csv).toContain('2026-11-05,09:07,650,TWD,訂閱服務,Anthropic,"Claude, 月費",中信卡,信用卡,Apple Pay,已確認\r\n')
  })
})

describe('makeBackup', () => {
  it('包含版本與時間', () => {
    const b = makeBackup({ categories: [] }, new Date('2026-11-16T00:00:00Z'))
    expect(b).toEqual({ app: 'expense-tracker', version: 1, exported_at: '2026-11-16T00:00:00.000Z', data: { categories: [] } })
  })
})
