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
}

export type TransactionInput = Pick<Transaction, 'amount' | 'merchant' | 'note' | 'category_id' | 'occurred_at'>
