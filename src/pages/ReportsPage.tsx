import { useEffect, useState } from 'react'
import type { Category, Transaction } from '../lib/types'
import { addMonths, formatTWD, monthRange, type Month } from '../lib/money'
import { byCategory, monthlyTotals, total } from '../lib/report'
import { listTransactions } from '../lib/api'
import MonthSwitcher from '../components/MonthSwitcher'

interface Props {
  month: Month
  onMonthChange: (m: Month) => void
  transactions: Transaction[]
  categories: Category[]
}

export default function ReportsPage({ month, onMonthChange, transactions, categories }: Props) {
  const rows = byCategory(transactions, categories)
  const sum = total(transactions)
  const max = Math.max(1, ...rows.map((r) => r.amount))

  // 近 6 個月趨勢：另外抓 6 個月的資料
  const [history, setHistory] = useState<Transaction[]>([])
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const start = monthRange(addMonths(month, -5)).start
    const end = monthRange(month).end
    listTransactions(start, end).then(setHistory).catch((e: Error) => setError(e.message))
  }, [month, transactions])
  const trend = monthlyTotals(history, month, 6)
  const trendMax = Math.max(1, ...trend.map((t) => t.amount))
  const [picked, setPicked] = useState<number | null>(null)

  return (
    <>
      <MonthSwitcher month={month} onChange={onMonthChange} />
      <section className="card">
        <h2>各分類支出</h2>
        <p className="muted small">本月合計 {formatTWD(sum)}</p>
        {rows.length === 0 ? (
          <p className="muted">這個月還沒有支出。</p>
        ) : (
          <ul className="bars">
            {rows.map((r) => (
              <li key={r.id ?? 'none'}>
                <div className="bar-label">
                  <span>{r.icon} {r.name}</span>
                  <span>
                    {formatTWD(r.amount)}
                    <span className="muted small"> · {Math.round((r.amount / sum) * 100)}%</span>
                  </span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(r.amount / max) * 100}%` }} />
                </div>
                {r.budget != null && r.budget > 0 && (
                  <p className={`small ${r.amount > r.budget ? 'warn' : 'muted'}`}>
                    {r.amount > r.budget
                      ? `⚠️ 超出預算 ${formatTWD(r.amount - r.budget)}（預算 ${formatTWD(r.budget)}）`
                      : `預算 ${formatTWD(r.budget)}，已用 ${Math.round((r.amount / r.budget) * 100)}%`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>近 6 個月趨勢</h2>
        {error ? <p className="error">讀取失敗：{error}</p> : (
          <>
            <p className="muted small" aria-live="polite">
              {picked == null ? '點長條可查看金額' : `${trend[picked].month.year} 年 ${trend[picked].month.month} 月：${formatTWD(trend[picked].amount)}`}
            </p>
            <div className="columns" role="list">
              {trend.map((t, i) => (
                <button key={i} role="listitem" className={`column${picked === i ? ' picked' : ''}`}
                  aria-label={`${t.month.month} 月 ${formatTWD(t.amount)}`} onClick={() => setPicked(picked === i ? null : i)}>
                  <span className="column-bar" style={{ height: `${(t.amount / trendMax) * 100}%` }} />
                  <span className="column-label">{t.month.month}月</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  )
}
