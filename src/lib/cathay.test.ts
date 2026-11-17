import { describe, expect, it } from 'vitest'
import { expandTables, parseBankCategory, parseText } from './parser'

// 國泰世華「消費彙整通知」經 Gmail 腳本轉成文字後的樣子（表格以 Tab 分隔；卡號、姓名已遮蔽）
const cathay = [
  '國泰世華銀行',
  '消費彙整通知',
  '通知日期：2026/11/16',
  '親愛的客戶，您好',
  '感謝您使用國泰世華銀行信用卡/簽帳金融卡消費，您最新的消費授權紀錄如下：',
  '卡號後4碼： 0000',
  '卡別\t行動卡號後4碼\t授權日期\t授權時間\t消費地區\t',
  '正卡\t\t2026/11/15\t18:27\tTW\t',
  '消費金額\t\t商店名稱\t消費類別\t備註\t',
  'NT$304\t\t優步\t餐飲\t\t',
  '*若對消費有疑異，請透過本行智能助理取得協助。',
  '*消費金額說明：雙幣信用卡之外幣消費金額以授權時間約當新臺幣金額計算，惟實際請款仍依外幣消費金額計算(如非約定外幣，其海外消費匯率依商店請款日為準)。',
].join('\n')

describe('國泰世華 Email（表格排版）', () => {
  it('把表格轉成「標題：數值」', () => {
    const t = expandTables(cathay)
    expect(t).toContain('授權日期：2026/11/15')
    expect(t).toContain('商店名稱：優步')
    expect(t).not.toContain('行動卡號後4碼：') // 空白欄位不輸出
  })
  it('讀出金額、商家、授權日期與時間（不是通知日期）', () => {
    const r = parseText(cathay, 'email', new Date(2026, 10, 16, 18, 30))
    expect([r.amount, r.currency, r.merchant]).toEqual([304, 'TWD', '優步'])
    const d = new Date(r.occurredAt!)
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([15, 18, 27])
  })
  it('讀出銀行的消費類別', () => {
    expect(parseBankCategory(cathay)).toBe('餐飲')
    expect(parseBankCategory('沒有類別的簡訊 NT$100')).toBeNull()
  })
  it('非表格的 Tab 文字不受影響', () => {
    expect(expandTables('a\tb\n1\t2')).toBe('a\tb\n1\t2')
  })
})
