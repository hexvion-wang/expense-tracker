import { expect, it } from 'vitest'
import { parseText } from './parser'

// 富邦 Email 有時沒有「交易內容」欄位：要讀得到金額與時間，但不能把說明文字誤當商家
const text = `即時消費通知 - 台北富邦銀行
富邦信用卡即時消費通知
親愛的卡友，您好：
感謝您使用富邦信用卡，依據您於本行網路銀行信用卡「服務申請」項目設定之卡片消費通知，以下為您最新的消費授權核准紀錄：
・消費卡號末四碼： 0000 -
・消費日期： 115 年 11 月 11 日
・消費時間： 20:39:42
・授權金額： NT$ 1,500 元
(註) 不含刷退、保費、學費、醫藥費、稅款、政府採購卡款項及約定信用卡扣繳款項。
※單筆刷卡滿1仟元即可分期，立即查詢期數及利率並申辦！
謝謝您的使用，祝您 事事順心、萬事如意！
台北富邦銀行 敬上`

it('富邦 Email 沒有交易內容時：金額與時間正確、商家留空', () => {
  const r = parseText(text, 'email', new Date(2026, 10, 17))
  expect(r.amount).toBe(1500)
  expect(r.merchant).toBeNull()
  const d = new Date(r.occurredAt!)
  expect([d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([11, 11, 20, 39])
})

it('有交易內容時照常讀出商家', () => {
  expect(parseText(text + '\n・交易內容： CLAUDE.AI', 'email', new Date(2026, 10, 17)).merchant).toBe('CLAUDE.AI')
})
