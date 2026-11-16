import { describe, expect, it } from 'vitest'
import { matchAccount, parseDate, parseText } from './parser'

const now = new Date(2026, 10, 16, 18, 0) // 2026/11/16 18:00

// 測試樣本：依台灣常見通知格式編寫的範例（非真實資料）
const samples: [string, string | undefined, { amount: number | null; currency: string | null; merchant: string | null }][] = [
  ['【國泰世華】您的信用卡末四碼1234於11/16 13:05在全家便利商店消費NT$120，如有疑問請洽客服', 'sms',
    { amount: 120, currency: 'TWD', merchant: '全家便利商店' }],
  ['中國信託信用卡消費通知：您於11/16 12:30消費新臺幣1,250元，商店：鼎泰豐信義店', 'sms',
    { amount: 1250, currency: 'TWD', merchant: '鼎泰豐信義店' }],
  ['玉山銀行通知 卡號末4碼5678 11/16 刷卡金額 TWD 650 特店 ANTHROPIC', 'sms',
    { amount: 650, currency: 'TWD', merchant: 'ANTHROPIC' }],
  ['台新卡友您好，您的卡片(尾號9012)於2026/11/16 09:12交易 NT$3,200 商店名稱:ANTHROPIC, PBC', 'sms',
    { amount: 3200, currency: 'TWD', merchant: 'ANTHROPIC' }],
  ['您的信用卡於11/16在 ANTHROPIC 消費 USD 20.00，實際請款金額以帳單為準', 'sms',
    { amount: 20, currency: 'USD', merchant: 'ANTHROPIC' }],
  ['您的信用卡於11/16在 OPENAI 消費 USD 20.00，約新台幣 650 元', 'sms',
    { amount: 650, currency: 'TWD', merchant: 'OPENAI' }],
  ['Apple Pay｜卡片：中信卡｜商家：全家便利商店｜金額：NT$120.00', 'applepay',
    { amount: 120, currency: 'TWD', merchant: '全家便利商店' }],
  ['Apple Pay｜卡片：國泰 CUBE｜商家：UBER EATS｜金額：$385', 'applepay',
    { amount: 385, currency: 'TWD', merchant: 'UBER EATS' }],
  ['13:20\n付款完成\n全家便利商店 台北信義店\nNT$85\n付款方式 LINE Pay Money\n交易日期 2026/11/16 13:20', 'ocr',
    { amount: 85, currency: 'TWD', merchant: '全家便利商店 台北信義店' }],
  ['LINE Pay\n付款完成\n店家名稱：八方雲集\n付款金額：NT$75', 'ocr',
    { amount: 75, currency: 'TWD', merchant: '八方雲集' }],
  ['付款成功 支付金額 $75 商店 八方雲集', 'ocr',
    { amount: 75, currency: 'TWD', merchant: '八方雲集' }],
  ['您已向 路易莎咖啡 付款 NT$ 95', 'ocr',
    { amount: 95, currency: 'TWD', merchant: '路易莎咖啡' }],
  ['【帳戶通知】您的網路銀行於11/16 10:00登入成功', 'sms',
    { amount: null, currency: null, merchant: null }],
]

describe('parseText', () => {
  it.each(samples)('%s', (text, source, expected) => {
    const r = parseText(text, source, now)
    expect({ amount: r.amount, currency: r.currency, merchant: r.merchant }).toEqual(expected)
  })

  it('不把卡號末四碼或時間當成金額', () => {
    expect(parseText('卡號末四碼1234 於 13:05 消費 NT$88', 'sms', now).amount).toBe(88)
  })
  it('拒絕格式奇怪的數字', () => {
    expect(parseText('消費 NT$1,23,4', 'sms', now).amount).toBeNull()
  })
})

describe('parseDate', () => {
  it('讀出完整日期與短日期', () => {
    expect(new Date(parseDate('2026/11/16 09:12', now)!).getHours()).toBe(9)
    const d = new Date(parseDate('於11/15 21:30在', now)!)
    expect([d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()]).toEqual([11, 15, 21, 30])
  })
  it('當天只有日期沒有時間時，改用收到的時間', () => {
    expect(parseDate('您的信用卡於 11/16 消費', now)).toBeNull()
    expect(new Date(parseDate('您的信用卡於 11/14 消費', now)!).getDate()).toBe(14)
  })
  it('跨年：1 月收到 12/31 的通知', () => {
    expect(new Date(parseDate('12/31 23:50', new Date(2027, 0, 1, 0, 5))!).getFullYear()).toBe(2026)
  })
  it('超過 90 天或未來的日期不採用', () => {
    expect(parseDate('2025/01/01', now)).toBeNull()
    expect(parseDate('2026/12/25', now)).toBeNull()
  })
})

describe('matchAccount', () => {
  const accounts = [
    { id: 'cathay', name: '國泰活存', last4: '1234', archived: false },
    { id: 'ctbc', name: '中信卡', last4: null, archived: false },
    { id: 'old', name: '舊卡', last4: '5678', archived: true },
  ]
  it('用末四碼或帳戶名稱對應', () => {
    expect(matchAccount('您的信用卡末四碼1234於11/16', accounts)).toBe('cathay')
    expect(matchAccount('Apple Pay｜卡片：中信卡｜商家：全家', accounts)).toBe('ctbc')
  })
  it('金額剛好是末四碼時不誤判；封存的帳戶不對應', () => {
    expect(matchAccount('消費 NT$1234', accounts)).toBeNull()
    expect(matchAccount('卡號末4碼5678', accounts)).toBeNull()
  })
})
