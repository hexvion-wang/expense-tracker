import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureDefaultCategories } from './lib/seed'
import { listAccounts, listCategories, listRules, listTransactions } from './lib/api'
import { currentMonth, monthRange, type Month } from './lib/money'
import type { Account, Category, Rule, Transaction } from './lib/types'
import { getLockSettings, setLockSettings } from './lib/lock'
import { backupOverdue, lastBackupAt } from './lib/backupReminder'
import Login from './components/Login'
import LockScreen from './components/LockScreen'
import TransactionForm from './components/TransactionForm'
import RulesSection from './components/RulesSection'
import ExportSection from './components/ExportSection'
import LockSection from './components/LockSection'
import HomePage from './pages/HomePage'
import ReportsPage from './pages/ReportsPage'
import AssetsPage from './pages/AssetsPage'
import CategoriesPage from './pages/CategoriesPage'

function signOut() {
  setLockSettings(null) // 登出時一併關閉這台裝置的 App 鎖
  return supabase!.auth.signOut()
}

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
  return <LockGate><Shell email={session.user.email ?? ''} /></LockGate>
}

/** 有開 App 鎖時：啟動時、以及離開 App 超過設定時間後回來時，要先用 Face ID 解鎖 */
function LockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(() => getLockSettings() != null)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    const onChange = () => {
      const s = getLockSettings()
      if (!s) return
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        if (s.afterMinutes === 0) setLocked(true) // 立即上鎖，也讓多工切換畫面看不到內容
      } else if (hiddenAt.current != null && Date.now() - hiddenAt.current >= s.afterMinutes * 60_000) {
        setLocked(true)
      }
    }
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  const settings = getLockSettings()
  if (locked && settings) return <LockScreen settings={settings} onUnlocked={() => setLocked(false)} onSignOut={signOut} />
  return <>{children}</>
}

type Tab = 'home' | 'reports' | 'assets' | 'settings'

function Shell({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>('home')
  const [month, setMonth] = useState<Month>(currentMonth())
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rules, setRules] = useState<Rule[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Transaction | 'new' | null>(null)
  const fail = (e: Error) => setError(e.message)

  const loadCategories = useCallback(async () => {
    await ensureDefaultCategories(supabase!)
    setCategories(await listCategories())
  }, [])
  const loadAccounts = useCallback(async () => setAccounts(await listAccounts()), [])
  const loadRules = useCallback(async () => setRules(await listRules()), [])
  const loadTransactions = useCallback(async () => {
    const { start, end } = monthRange(month)
    setTransactions(await listTransactions(start, end))
  }, [month])

  useEffect(() => { loadCategories().catch(fail) }, [loadCategories])
  useEffect(() => { loadAccounts().catch(fail); loadRules().catch(fail) }, [loadAccounts, loadRules])
  useEffect(() => { loadTransactions().catch(fail) }, [loadTransactions])

  // 從背景切回 App 時重新整理（之後捷徑自動記帳的資料會這樣出現）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      loadTransactions().catch(() => {})
      loadAccounts().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [loadTransactions, loadAccounts])

  const refreshTxAndAccounts = () => { loadTransactions().catch(fail); loadAccounts().catch(fail) }
  const titles: Record<Tab, string> = { home: '我的記帳本', reports: '報表', assets: '資產', settings: '設定' }
  const showBackupBanner = tab === 'home' && transactions.length > 0 && backupOverdue(lastBackupAt())

  return (
    <>
      <main className="app with-tabs">
        <h1>{titles[tab]}</h1>
        {error && <p className="error" role="alert">讀取失敗：{error}（如果是新功能，請確認已在 SQL Editor 執行最新的 migration）</p>}
        {showBackupBanner && (
          <button className="banner" onClick={() => setTab('settings')}>🗄️ 已經一段時間沒有備份了，點這裡到「設定」做完整備份</button>
        )}
        {tab === 'home' && (
          <HomePage month={month} onMonthChange={setMonth} transactions={transactions} categories={categories} onEdit={setForm} />
        )}
        {tab === 'reports' && (
          <ReportsPage month={month} onMonthChange={setMonth} transactions={transactions} categories={categories} />
        )}
        {tab === 'assets' && <AssetsPage accounts={accounts} onChanged={() => loadAccounts().catch(fail)} />}
        {tab === 'settings' && (
          <>
            <CategoriesPage categories={categories} onChanged={() => { loadCategories().catch(fail); loadTransactions().catch(() => {}) }} />
            <RulesSection rules={rules} categories={categories} accounts={accounts}
              onChanged={() => { loadRules().catch(fail); refreshTxAndAccounts() }} />
            <ExportSection month={month} monthTransactions={transactions} categories={categories} accounts={accounts} />
            <LockSection email={email} />
            <section className="card">
              <h2>帳號</h2>
              <p className="muted small">已登入：{email}</p>
              <button className="danger" onClick={signOut}>登出</button>
            </section>
          </>
        )}
      </main>

      {tab === 'home' && <button className="fab" aria-label="新增支出" onClick={() => setForm('new')}>＋</button>}

      <nav className="tabbar" aria-label="主要分頁">
        {([['home', '🏠', '首頁'], ['reports', '📊', '報表'], ['assets', '🏦', '資產'], ['settings', '⚙️', '設定']] as const).map(([key, icon, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
            <span aria-hidden>{icon}</span>{label}
          </button>
        ))}
      </nav>

      {form && (
        <TransactionForm categories={categories} accounts={accounts} rules={rules} editing={form === 'new' ? null : form}
          onCancel={() => setForm(null)}
          onDone={() => { setForm(null); refreshTxAndAccounts() }} />
      )}
    </>
  )
}
