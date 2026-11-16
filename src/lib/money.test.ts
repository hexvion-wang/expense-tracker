import { describe, expect, it } from 'vitest'
import { addMonths, formatTWD, parseAmount } from './money'

describe('parseAmount', () => {
  it('接受一般金額與逗號', () => {
    expect(parseAmount('120')).toBe(120)
    expect(parseAmount('1,234.5')).toBe(1234.5)
    expect(parseAmount(' 99 ')).toBe(99)
  })
  it('拒絕不合法的輸入', () => {
    for (const bad of ['', '0', '-5', 'abc', '1.234', '1e5']) expect(parseAmount(bad)).toBeNull()
  })
})

describe('addMonths', () => {
  it('跨年', () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 11 }, -5)).toEqual({ year: 2026, month: 6 })
  })
})

describe('formatTWD', () => {
  it('加上千分位', () => {
    expect(formatTWD(1234567)).toBe('NT$ 1,234,567')
    expect(formatTWD(0.1 + 0.2)).toBe('NT$ 0.3')
  })
})
