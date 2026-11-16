import type { SupabaseClient } from '@supabase/supabase-js'

// 第一次登入時建立的預設分類，之後可以在 App 裡自行修改
export const DEFAULT_CATEGORIES = [
  { name: '餐飲', icon: '🍱' },
  { name: '交通', icon: '🚇' },
  { name: '購物', icon: '🛍️' },
  { name: '娛樂', icon: '🎬' },
  { name: '訂閱服務', icon: '🔁' },
  { name: '生活帳單', icon: '💡' },
  { name: '醫療', icon: '🏥' },
  { name: '其他', icon: '📦' },
]

export async function ensureDefaultCategories(client: SupabaseClient): Promise<void> {
  const { count, error } = await client.from('categories').select('id', { count: 'exact', head: true })
  if (error) throw error
  if ((count ?? 0) > 0) return
  const rows = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort_order: i }))
  const { error: insertError } = await client.from('categories').insert(rows)
  // 23505 = 重複（例如兩個分頁同時建立），可以忽略
  if (insertError && insertError.code !== '23505') throw insertError
}
