import type { Rule } from './types'

/** 檢查使用者輸入的規則是否可用；回傳錯誤訊息或 null */
export function validatePattern(matchType: Rule['match_type'], pattern: string): string | null {
  const p = pattern.trim()
  if (!p) return '請輸入要比對的文字'
  if (p.length > 200) return '最多 200 個字'
  if (matchType === 'regex') {
    try { new RegExp(p, 'i') } catch { return '正規表示式格式錯誤' }
  }
  return null
}

function matches(rule: Rule, text: string): boolean {
  if (!rule.enabled || !text) return false
  if (rule.match_type === 'contains') return text.toLowerCase().includes(rule.pattern.trim().toLowerCase())
  try {
    return new RegExp(rule.pattern, 'i').test(text.slice(0, 2000))
  } catch {
    return false
  }
}

/** 依優先順序（大者先，同分則先建立者先）找出第一條符合的規則；比對商家名稱，也比對原始文字 */
export function findRule(rules: Rule[], merchant: string | null, rawText?: string | null): Rule | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at))
  const texts = [merchant ?? '', rawText ?? ''].filter(Boolean)
  return sorted.find((r) => texts.some((t) => matches(r, t))) ?? null
}
