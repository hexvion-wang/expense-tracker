import { createClient } from '@supabase/supabase-js'
import { readConfig } from './config'

export const config = readConfig(import.meta.env)

export const supabase = config
  ? createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null
