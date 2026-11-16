import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_CATEGORIES, ensureDefaultCategories } from './seed'

describe('ensureDefaultCategories', () => {
  it('同時呼叫兩次只建立一次', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const client = {
      from: () => ({ select: () => Promise.resolve({ count: 0, error: null }), insert }),
    } as unknown as SupabaseClient
    await Promise.all([ensureDefaultCategories(client), ensureDefaultCategories(client)])
    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert.mock.calls[0][0]).toHaveLength(DEFAULT_CATEGORIES.length)
  })
})
