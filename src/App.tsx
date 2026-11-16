import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { ensureDefaultCategories } from './lib/seed'
import Login from './components/Login'

interface Category { id: string; name: string; icon: string }

export default function App() {
  const month = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return (
    <main className="app">
      <header className="top">
        <div>
          <h1>我的記帳本</h1>
          <p className="muted">{month}</p>
        </div>
        {session && supabase && (
          <button className="link" onClick={() => supabase!.auth.signOut()}>登出</button>
        )}
      </header>

      {!supabase ? (
        <section className="card">
          <h2>尚未設定資料庫</h2>
          <p className="muted">缺少 Supabase 的連線設定（VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY）。請依照 docs/supabase-setup.md 設定。</p>
        </section>
      ) : loading ? (
        <p className="muted">載入中…</p>
      ) : session ? (
        <Home email={session.user.email ?? ''} />
      ) : (
        <Login client={supabase} />
      )}
    </main>
  )
}

function Home({ email }: { email: string }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const client = supabase!
    ensureDefaultCategories(client)
      .then(() => client.from('categories').select('id, name, icon').order('sort_order'))
      .then(({ data, error }) => {
        if (error) throw error
        setCategories(data ?? [])
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <>
      <section className="card">
        <p className="label">本月支出</p>
        <p className="total">NT$ 0</p>
        <p className="muted">已登入：{email}</p>
      </section>
      <section className="card">
        <h2>分類</h2>
        {error ? (
          <p className="muted">讀取失敗：{error}（是否已在 SQL Editor 執行 001_init.sql？）</p>
        ) : (
          <div className="chips">
            {categories.map((c) => <span key={c.id} className="chip">{c.icon} {c.name}</span>)}
          </div>
        )}
      </section>
      <section className="card">
        <h2>開發進度</h2>
        <ul>
          <li>✅ 第 2 階段：PWA 骨架與自動部署</li>
          <li>✅ 第 3 階段：資料庫與登入</li>
          <li>⬜ 第 4 階段：手動記帳、分類、月報表</li>
          <li>⬜ 第 5–7 階段：規則與捷徑自動記帳</li>
        </ul>
      </section>
    </>
  )
}
