// 從簡訊、Apple Pay、截圖文字中讀出金額、幣別、商家、時間
import type { Account } from './types'

export interface Parsed {
  amount: number | null
  currency: string | null // 'TWD' 或外幣代碼
  merchant: string | null
  occurredAt: string | null // ISO；讀不到則 null
}

const NUM = '([0-9][0-9,]*(?:\\.[0-9]{1,2})?)'
const toNumber = (s: string): number | null => {
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s.replace(/,/g, ''))
  return n > 0 && n < 100_000_000 ? n : null
}

const TWD_PATTERNS = [
  new RegExp(`(?:NT\\$|NTD|TWD|新[臺台]幣|[臺台]幣)\\s*${NUM}`, 'i'),
  new RegExp(`${NUM}\\s*(?:元|TWD|NTD)`, 'i'),
  new RegExp(`(?:金額|消費|刷卡|支付|付款|交易|扣款)[^0-9$\\n]{0,8}\\$\\s*${NUM}`),
]
const FOREIGN = new RegExp(`(?:\\b(USD|JPY|EUR|HKD|CNY|RMB|KRW|GBP|SGD|AUD|CAD|THB)\\s*\\$?\\s*${NUM}|\\b(US|HK|S|A|C)\\$\\s*${NUM})`, 'i')
const BARE_DOLLAR = new RegExp(`\\$\\s*${NUM}`, 'g')

export function parseAmount(text: string): { amount: number; currency: string } | null {
  for (const re of TWD_PATTERNS) {
    const m = text.match(re)
    const n = m && toNumber(m[1])
    if (n) return { amount: n, currency: 'TWD' }
  }
  const f = text.match(FOREIGN)
  if (f) {
    const code = (f[1] ?? `${f[3]}D`).toUpperCase().replace('RMB', 'CNY')
    const n = toNumber(f[2] ?? f[4])
    if (n) return { amount: n, currency: code }
  }
  // 只有一個「$金額」時視為台幣（台灣的 App 常這樣寫）
  const bare = [...text.matchAll(BARE_DOLLAR)].map((m) => toNumber(m[1])).filter((n): n is number => n != null)
  if (bare.length === 1 || (bare.length > 1 && bare.every((n) => n === bare[0]))) return { amount: bare[0], currency: 'TWD' }
  return null
}

const STOP = '(?=\\s*(?:[，,。；;|｜:：\\n]|$|消費|刷卡|交易|金額|付款|回饋|NT\\$|新[臺台]幣|TWD|\\$|已|，))'
const MERCHANT_PATTERNS = [
  // 標籤前面不能緊接中文字（避免把「便利商店」的「商店」當成標籤），後面要有冒號或空白
  new RegExp(`(?<![\\u4e00-\\u9fff])(?:商店\\s*名稱|特店\\s*名稱|店家\\s*名稱|交易\\s*商店|消費\\s*商店|消費\\s*地點|收款方|商家|商店|特店|店家|店名)(?:\\s*[:：]\\s*|\\s+)([^\\n，,。；;|｜]+?)${STOP}`),
  /在\s*([^\n，,。；;\d][^\n，,。；;]*?)\s*(?:消費|刷卡|交易|使用)/,
  /於\s*([^\n，,。；;\d/][^\n，,。；;]*?)\s*(?:消費|刷卡)/,
  /向\s*([^\n，,。；;]+?)\s*(?:付款|支付)/,
]

function cleanMerchant(s: string | undefined): string | null {
  if (!s) return null
  const m = s.replace(/\s+/g, ' ').replace(/^[:：\s]+|[\s:：]+$/g, '').slice(0, 60)
  if (m.length < 2 || /^[\d\s/:.\-]+$/.test(m) || /^(您|你)/.test(m)) return null
  return m
}

const OCR_SKIP = /付款完成|付款成功|交易成功|支付成功|完成|金額|NT\$|\$|元|付款方式|交易|日期|時間|訂單|明細|返回|點數|回饋|LINE Pay|街口|全支付|收據|^\d|^[A-Z]?\d|分享|關閉/i

export function parseMerchant(text: string, source?: string): string | null {
  for (const re of MERCHANT_PATTERNS) {
    const m = cleanMerchant(text.match(re)?.[1] ?? text.replace(/\n/g, ' ').match(re)?.[1])
    if (m) return m
  }
  if (source === 'ocr') {
    // 截圖：付款完成畫面通常是「付款完成 → 店名 → 金額」，取第一行不是關鍵字的文字
    const line = text.split('\n').map((l) => l.trim()).find((l) => l.length >= 2 && l.length <= 40 && !OCR_SKIP.test(l))
    return cleanMerchant(line)
  }
  return null
}

/** 讀出交易時間；now 是收到通知的時間。只接受過去 90 天內（避免把其他日期誤認） */
export function parseDate(text: string, now = new Date()): string | null {
  // 通知常見的「昨天 晚上 11:01」「今天 下午 2:05」
  const rel = text.match(/(今天|昨天)\s*(上午|早上|凌晨|中午|下午|晚上)?\s*(\d{1,2})[:：](\d{2})/)
  if (rel) {
    let h = +rel[3]
    if (['下午', '晚上'].includes(rel[2]) && h < 12) h += 12
    if (['凌晨', '上午', '早上'].includes(rel[2]) && h === 12) h = 0
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (rel[1] === '昨天' ? 1 : 0), h, +rel[4])
    return d.getTime() <= now.getTime() + 60_000 ? d.toISOString() : null
  }
  const full = text.match(/(20\d{2})[/.-](\d{1,2})[/.-](\d{1,2})\s*(?:(\d{1,2}):(\d{2}))?/)
  const short = full ? null : text.match(/(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])\s*(?:(\d{1,2}):(\d{2}))?/)
  let d: Date | null = null
  if (full) d = new Date(+full[1], +full[2] - 1, +full[3], full[4] ? +full[4] : 12, full[5] ? +full[5] : 0)
  else if (short) {
    d = new Date(now.getFullYear(), +short[1] - 1, +short[2], short[3] ? +short[3] : 12, short[4] ? +short[4] : 0)
    if (d.getTime() > now.getTime() + 86_400_000) d.setFullYear(d.getFullYear() - 1) // 12/31 的簡訊在 1/1 才處理
  }
  if (!d || isNaN(d.getTime())) return null
  // 只有日期、沒有時間，而且就是收到通知的當天：回傳 null，改用收到的時間（比中午 12 點準）
  const hasTime = full ? !!full[4] : !!short?.[3]
  if (!hasTime && d.toDateString() === now.toDateString()) return null
  const diff = now.getTime() - d.getTime()
  return diff > -86_400_000 && diff < 90 * 86_400_000 ? d.toISOString() : null
}

export function parseText(text: string, source?: string, now = new Date()): Parsed {
  const a = parseAmount(text)
  return { amount: a?.amount ?? null, currency: a?.currency ?? null, merchant: parseMerchant(text, source), occurredAt: parseDate(text, now) }
}

/** 從文字找出付款帳戶：「末四碼 1234」這類寫法，或文字中出現帳戶名稱 */
export function matchAccount(text: string, accounts: Pick<Account, 'id' | 'name' | 'last4' | 'archived'>[]): string | null {
  const active = accounts.filter((a) => !a.archived)
  for (const a of active) {
    if (a.last4 && new RegExp(`(?:末四碼|末4碼|末碼|尾號|尾數|後四碼|卡號|[*＊xX]{2,}|卡)\\D{0,6}${a.last4}(?!\\d)`).test(text)) return a.id
  }
  const lower = text.toLowerCase()
  const byName = active.filter((a) => a.name.length >= 2 && lower.includes(a.name.toLowerCase()))
  return byName.length === 1 ? byName[0].id : null
}
