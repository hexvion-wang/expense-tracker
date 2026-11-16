export interface Category {
  id: string
  name: string
  icon: string
  monthly_budget: number | null
  sort_order: number
}

export type Source = 'manual' | 'applepay' | 'sms' | 'ocr'

export interface Transaction {
  id: string
  amount: number | null
  currency: string
  merchant: string | null
  note: string | null
  category_id: string | null
  source: Source
  status: 'confirmed' | 'pending'
  raw_text: string | null
  occurred_at: string
  account_id: string | null
}

export type TransactionInput = Pick<Transaction, 'amount' | 'merchant' | 'note' | 'category_id' | 'occurred_at' | 'account_id'>

export type AccountType = 'bank' | 'credit_card' | 'e_wallet' | 'cash' | 'other'

export const ACCOUNT_TYPES: Record<AccountType, { label: string; icon: string }> = {
  bank: { label: '銀行', icon: '🏦' },
  credit_card: { label: '信用卡', icon: '💳' },
  e_wallet: { label: '電子錢包', icon: '📱' },
  cash: { label: '現金', icon: '💵' },
  other: { label: '其他', icon: '🗂️' },
}

export interface Account {
  id: string
  name: string
  type: AccountType
  institution: string | null
  last4: string | null
  opening_balance: number
  note: string | null
  sort_order: number
  archived: boolean
  balance: number // 由 account_balances view 計算
}

export interface Rule {
  id: string
  match_type: 'contains' | 'regex'
  pattern: string
  category_id: string
  account_id: string | null
  note_template: string | null
  priority: number
  enabled: boolean
  created_at: string
}
