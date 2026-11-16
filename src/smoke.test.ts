import { describe, expect, it } from 'vitest'

// 暫時的測試，確認測試流程可以跑；第 5 階段會換成解析器與規則的真正測試
describe('smoke', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })
})
