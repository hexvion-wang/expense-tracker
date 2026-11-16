import { supabase } from './supabase'
import type { Category, Transaction, TransactionInput } from './types'

const db = () => supabase!

const TX_COLUMNS = 'id, amount, currency, merchant, note, category_id, source, status, raw_text, occurred_at'

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await db().from('categories').select('id, name, icon, monthly_budget, sort_order').order('sort_order')
  if (error) throw error
  return (data ?? []).map((c) => ({ ...c, monthly_budget: c.monthly_budget == null ? null : Number(c.monthly_budget) }))
}

export async function listTransactions(start: string, end: string): Promise<Transaction[]> {
  const { data, error } = await db().from('transactions').select(TX_COLUMNS)
    .gte('occurred_at', start).lt('occurred_at', end).order('occurred_at', { ascending: false })
  if (error) throw error
  // Postgres 的 numeric 會以字串傳回，轉成數字
  return (data ?? []).map((t) => ({ ...t, amount: t.amount == null ? null : Number(t.amount) }))
}

export async function saveTransaction(input: TransactionInput, id?: string): Promise<void> {
  // 手動填好金額的交易，一律視為已確認
  const row = { ...input, status: input.amount != null ? 'confirmed' : 'pending' }
  const { error } = id
    ? await db().from('transactions').update(row).eq('id', id)
    : await db().from('transactions').insert({ ...row, source: 'manual' })
  if (error) throw error
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await db().from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function saveCategory(c: Pick<Category, 'name' | 'icon' | 'monthly_budget'>, id?: string, sortOrder?: number): Promise<void> {
  const { error } = id
    ? await db().from('categories').update(c).eq('id', id)
    : await db().from('categories').insert({ ...c, sort_order: sortOrder ?? 99 })
  if (error) throw error.code === '23505' ? new Error('已經有同名的分類') : error
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await db().from('categories').delete().eq('id', id)
  if (error) throw error
}
