import { describe, expect, it } from 'vitest'
import { hasLongNumber } from './sensitive'

describe('hasLongNumber', () => {
  it('擋下卡號與帳號', () => {
    expect(hasLongNumber('4311 2222 3333 4444')).toBe(true)
    expect(hasLongNumber('帳號 012-345-678901')).toBe(true)
    expect(hasLongNumber('0123456789')).toBe(true)
  })
  it('允許一般文字與短數字', () => {
    expect(hasLongNumber('國泰活存 末四碼 1234')).toBe(false)
    expect(hasLongNumber('2026 年 11 月')).toBe(false)
    expect(hasLongNumber(null)).toBe(false)
  })
})
