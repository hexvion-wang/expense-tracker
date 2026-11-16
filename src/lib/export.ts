import type { Account, Category, Transaction } from './types'
import { ACCOUNT_TYPES } from './types'

const STATUS = { confirmed: '已確認', pending: '待確認' } as const
const SOURCE = { manual: '手動', applepay: 'Apple Pay', sms: '簡訊', ocr: '截圖' } as const

/**
 * 轉成 CSV 儲存格。
 * 安全：以 = + - @ 開頭的文字在 Excel 會被當成公式執行（CSV 注入），所以前面加上 ' 讓它變成純文字。
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null) return ''
  let s = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function transactionsToCsv(txs: Transaction[], categories: Category[], accounts: Pick<Account, 'id' | 'name' | 'type'>[]): string {
  const header = ['日期', '時間', '金額', '幣別', '分類', '商家', '備註', '帳戶', '帳戶類型', '來源', '狀態']
  const rows = [...txs]
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))
    .map((t) => {
      const d = new Date(t.occurred_at)
      const pad = (n: number) => String(n).padStart(2, '0')
      const acc = accounts.find((a) => a.id === t.account_id)
      return [
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        t.amount,
        t.currency,
        categories.find((c) => c.id === t.category_id)?.name ?? '未分類',
        t.merchant,
        t.note,
        acc?.name ?? null,
        acc ? ACCOUNT_TYPES[acc.type].label : null,
        SOURCE[t.source],
        STATUS[t.status],
      ]
    })
  // 開頭的 BOM 讓 Excel 正確辨識 UTF-8 中文；換行用 CRLF 符合 CSV 標準
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export const BACKUP_VERSION = 1

export interface Backup {
  app: 'expense-tracker'
  version: number
  exported_at: string
  data: Record<string, unknown[]>
}

export function makeBackup(data: Record<string, unknown[]>, now = new Date()): Backup {
  return { app: 'expense-tracker', version: BACKUP_VERSION, exported_at: now.toISOString(), data }
}

/** 產生檔名用的日期字串，例如 20261116 */
export function stamp(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** iPhone 上用「分享」選單存檔（可存到檔案 App / iCloud）；不支援時改用一般下載 */
export async function saveFile(name: string, content: string, type: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([content], name, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
