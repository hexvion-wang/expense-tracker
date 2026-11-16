import { describe, expect, it } from 'vitest'
import { findRule, validatePattern } from './rules'
import type { Rule } from './types'

let n = 0
const rule = (p: Partial<Rule>): Rule => ({
  id: String(++n), match_type: 'contains', pattern: '', category_id: 'c', account_id: null,
  note_template: null, priority: 0, enabled: true, created_at: `2026-01-0${n}T00:00:00Z`, ...p,
})

describe('findRule', () => {
  const anthropic = rule({ pattern: 'anthropic', category_id: 'sub', note_template: 'Claude AI 月費' })
  const seven = rule({ match_type: 'regex', pattern: '^(7-?eleven|統一超商)', category_id: 'food' })
  const all = [anthropic, seven]

  it('不分大小寫比對商家', () => {
    expect(findRule(all, 'ANTHROPIC.AI')?.note_template).toBe('Claude AI 月費')
    expect(findRule(all, '統一超商 信義店')?.category_id).toBe('food')
    expect(findRule(all, '7-ELEVEN')?.category_id).toBe('food')
  })
  it('商家沒中時比對原始文字', () => {
    expect(findRule(all, null, '您於 ANTHROPIC 消費 NT$650')?.category_id).toBe('sub')
  })
  it('沒有符合時回傳 null，停用的規則不算', () => {
    expect(findRule(all, '全聯')).toBeNull()
    expect(findRule([rule({ pattern: '全聯', enabled: false })], '全聯')).toBeNull()
  })
  it('優先順序高的先比對', () => {
    const low = rule({ pattern: 'uber', category_id: 'traffic' })
    const high = rule({ pattern: 'uber eats', category_id: 'food', priority: 10 })
    expect(findRule([low, high], 'Uber Eats')?.category_id).toBe('food')
    expect(findRule([low, high], 'Uber 車資')?.category_id).toBe('traffic')
  })
  it('壞掉的正規表示式不會讓程式當掉', () => {
    expect(findRule([rule({ match_type: 'regex', pattern: '(' })], 'x')).toBeNull()
  })
})

describe('validatePattern', () => {
  it('檢查空白與錯誤的正規表示式', () => {
    expect(validatePattern('contains', '  ')).not.toBeNull()
    expect(validatePattern('regex', '(abc')).not.toBeNull()
    expect(validatePattern('regex', 'abc|def')).toBeNull()
  })
})
