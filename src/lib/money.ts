const fmt = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 })

export function formatTWD(n: number): string {
  return `NT$ ${fmt.format(Math.round(n * 100) / 100)}`
}

/** 解析使用者輸入的金額：允許逗號、空白，最多兩位小數；不合法回傳 null */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[,\s]/g, '')
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null
  const n = Number(s)
  return n > 0 ? n : null
}

export interface Month { year: number; month: number } // month: 1–12

export function currentMonth(d = new Date()): Month {
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function addMonths(m: Month, delta: number): Month {
  const i = m.year * 12 + (m.month - 1) + delta
  return { year: Math.floor(i / 12), month: (i % 12) + 1 }
}

/** 該月（依手機所在時區）的起訖時間，回傳 ISO 字串，區間為 [start, end) */
export function monthRange(m: Month): { start: string; end: string } {
  const start = new Date(m.year, m.month - 1, 1)
  const end = new Date(m.year, m.month, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function monthLabel(m: Month): string {
  return `${m.year} 年 ${m.month} 月`
}

/** 把 ISO 時間轉成 <input type="datetime-local"> 需要的本地時間字串 */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
