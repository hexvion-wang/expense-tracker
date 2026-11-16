export default function App() {
  const month = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' })
  return (
    <main className="app">
      <header>
        <h1>我的記帳本</h1>
        <p className="muted">{month}</p>
      </header>
      <section className="card">
        <p className="label">本月支出</p>
        <p className="total">NT$ 0</p>
      </section>
      <section className="card">
        <h2>開發進度</h2>
        <ul>
          <li>✅ 第 2 階段：PWA 骨架與自動部署</li>
          <li>⬜ 第 3 階段：資料庫與登入</li>
          <li>⬜ 第 4 階段：手動記帳、分類、月報表</li>
          <li>⬜ 第 5–7 階段：規則與捷徑自動記帳</li>
        </ul>
      </section>
    </main>
  )
}
