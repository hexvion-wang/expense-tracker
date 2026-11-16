import { supabase } from './supabase'
import type { Account, Category, Rule, Transaction, TransactionInput } from './types'
import { findRule } from './rules'

const db = () => supabase!

const TX_COLUMNS = 'id, amount, currency, merchant, note, category_id, source, status, raw_text, occurred_at, account_id'

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

// ---------- 資產帳戶 ----------
const num = (v: unknown) => (v == null ? 0 : Number(v))

export async function listAccounts(): Promise<Account[]> {
  const [{ data, error }, { data: balances, error: e2 }] = await Promise.all([
    db().from('accounts').select('id, name, type, institution, last4, opening_balance, note, sort_order, archived').order('sort_order'),
    db().from('account_balances').select('id, balance'),
  ])
  if (error) throw error
  if (e2) throw e2
  return (data ?? []).map((a) => ({
    ...a,
    opening_balance: num(a.opening_balance),
    balance: num(balances?.find((b) => b.id === a.id)?.balance ?? a.opening_balance),
  }))
}

export type AccountInput = Pick<Account, 'name' | 'type' | 'institution' | 'last4' | 'opening_balance' | 'note' | 'archived'>

export async function saveAccount(a: AccountInput, id?: string, sortOrder?: number): Promise<void> {
  const { error } = id
    ? await db().from('accounts').update(a).eq('id', id)
    : await db().from('accounts').insert({ ...a, sort_order: sortOrder ?? 99 })
  if (error) throw error.code === '23505' ? new Error('已經有同名的帳戶') : error.code === '23514' ? new Error('內容含有不允許的資料（例如完整卡號或帳號）') : error
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await db().from('accounts').delete().eq('id', id)
  if (error) throw error
}

export async function addAdjustment(accountId: string, amount: number, note: string | null): Promise<void> {
  const { error } = await db().from('account_adjustments').insert({ account_id: accountId, amount, note })
  if (error) throw error
}

// ---------- 規則 ----------
export async function listRules(): Promise<Rule[]> {
  const { data, error } = await db().from('rules')
    .select('id, match_type, pattern, category_id, account_id, note_template, priority, enabled, created_at')
    .order('priority', { ascending: false }).order('created_at')
  if (error) throw error
  return data ?? []
}

export type RuleInput = Pick<Rule, 'match_type' | 'pattern' | 'category_id' | 'account_id' | 'note_template' | 'priority' | 'enabled'>

export async function saveRule(r: RuleInput, id?: string): Promise<void> {
  const { error } = id ? await db().from('rules').update(r).eq('id', id) : await db().from('rules').insert(r)
  if (error) throw error
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await db().from('rules').delete().eq('id', id)
  if (error) throw error
}

/** 對「未分類」的紀錄套用規則（不會覆蓋你自己選過的分類）；回傳更新筆數 */
export async function applyRulesToUncategorized(rules: Rule[]): Promise<number> {
  const txs = await listAllTransactions()
  let updated = 0
  for (const t of txs.filter((x) => x.category_id == null)) {
    const r = findRule(rules, t.merchant, t.raw_text)
    if (!r) continue
    const patch: Partial<Transaction> = { category_id: r.category_id }
    if (r.account_id && !t.account_id) patch.account_id = r.account_id
    if (r.note_template && !t.note) patch.note = r.note_template
    const { error } = await db().from('transactions').update(patch).eq('id', t.id)
    if (error) throw error
    updated++
  }
  return updated
}

// ---------- 匯出／備份 ----------
/** 分批讀取整張表（Supabase 一次最多回傳 1000 筆） */
export async function fetchAll(table: string, columns = '*'): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await db().from(table).select(columns).order('id').range(from, from + size - 1)
    if (error) throw error
    out.push(...((data ?? []) as unknown as Record<string, unknown>[]))
    if (!data || data.length < size) return out
  }
}

export const BACKUP_TABLES = ['categories', 'accounts', 'account_adjustments', 'rules', 'transactions'] as const

export async function fetchBackupData(): Promise<Record<string, unknown[]>> {
  const entries = await Promise.all(BACKUP_TABLES.map(async (t) => [t, await fetchAll(t)] as const))
  return Object.fromEntries(entries)
}

export async function listAllTransactions(): Promise<Transaction[]> {
  return ((await fetchAll('transactions', TX_COLUMNS)) as unknown as Transaction[])
    .map((t) => ({ ...t, amount: t.amount == null ? null : Number(t.amount) }))
}
