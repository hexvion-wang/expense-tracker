import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureDefaultCategories } from './lib/seed'
import { listCategories, listTransactions } from './lib/api'
import { currentMonth, monthRange, type Month } from './lib/money'
import type { Category, Transaction } from './lib/types'
import Login from './components/Login'
import TransactionForm from './components/TransactionForm'
import HomePage from './pages/HomePage'
import ReportsPage from './pages/ReportsPage'
import CategoriesPage from './pages/CategoriesPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!supabase) {
    return (
      <main className="app">
        <h1>我的記帳本</h1>
        <section className="card">
          <h2>尚未設定資料庫</h2>
          <p className="muted">缺少 Supabase 的連線設定（VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY）。請依照 docs/supabase-setup.md 設定。</p>
        </section>
      </main>
    )
  }
  if (loading) return <main className="app"><p className="muted">載入中…</p></main>
  if (!session) return <main className="app"><h1>我的記帳本</h1><Login client={supabase} /></main>
  return <Shell email={session.user.email ?? ''} />
}

type Tab = 'home' | 'reports' | 'settings'

function Shell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState<Month>(currentMonth())
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Transaction | 'new' | null>(null)

  const loadCategories = useCallback(async () => {
    await ensureDefaultCategories(supabase!)
    setCategories(await listCategories())
  }, [])

  const loadTransactions = useCallback(async () => {
    const { start, end } = monthRange(month)
    setTransactions(await listTransactions(start, end))
  }, [month])

  useEffect(() => { loadCategories().catch((e: Error) => setError(e.message)) }, [loadCategories])
  useEffect(() => { loadTransactions().catch((e: Error) => setError(e.message)) }, [loadTransactions])

  // 從背景切回 App 時重新整理（之後捷徑自動記帳的資料會這樣出現）
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') loadTransactions().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadTransactions])

  const titles: Record<Tab, string> = { home: '我的記帳本', reports: '報表', settings: '設定' }

  return (
    <>
      <main className="app with-tabs">
        <h1>{titles[tab]}</h1>
        {error && <p className="error" role="alert">讀取失敗：{error}</p>}
        {tab === 'home' && (
          <HomePage month={month} onMonthChange={setMonth} transactions={transactions} categories={categories} onEdit={setForm} />
        )}
        {tab === 'reports' && (
          <ReportsPage month={month} onMonthChange={setMonth} transactions={transactions} categories={categories} />
        )}
        {tab === 'settings' && (
          <CategoriesPage categories={categories} email={email}
            onChanged={() => { loadCategories().catch((e: Error) => setError(e.message)); loadTransactions().catch(() => {}) }}
            onSignOut={() => supabase!.auth.signOut()} />
        )}
      </main>

      {tab === 'home' && (
        <button className="fab" aria-label="新增支出" onClick={() => setForm('new')}>＋</button>
      )}

      <nav className="tabbar" aria-label="主要分頁">
        {([['home', '🏠', '首頁'], ['reports', '📊', '報表'], ['settings', '⚙️', '設定']] as const).map(([key, icon, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
            <span aria-hidden>{icon}</span>{label}
          </button>
        ))}
      </nav>

      {form && (
        <TransactionForm categories={categories} editing={form === 'new' ? null : form}
          onCancel={() => setForm(null)}
          onDone={() => { setForm(null); loadTransactions().catch((e: Error) => setError(e.message)) }} />
      )}
    </>
  )
}
