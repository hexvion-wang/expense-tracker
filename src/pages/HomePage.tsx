import type { Category, Transaction } from '../lib/types'
import { formatTWD, type Month } from '../lib/money'
import { groupByDay, total } from '../lib/report'
import MonthSwitcher from '../components/MonthSwitcher'

interface Props {
  month: Month
  onMonthChange: (m: Month) => void
  transactions: Transaction[]
  categories: Category[]
  onEdit: (t: Transaction) => void
}

export default function HomePage({ month, onMonthChange, transactions, categories, onEdit }: Props) {
  const sum = total(transactions)
  const budget = categories.reduce((s, c) => s + (c.monthly_budget ?? 0), 0)
  const pending = transactions.filter((t) => t.status === 'pending').length

  return (
    <>
      <MonthSwitcher month={month} onChange={onMonthChange} />
      <section className="card">
        <p className="label">本月支出</p>
        <p className="total">{formatTWD(sum)}</p>
        {budget > 0 && (
          <>
            <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={sum}>
              <div className={`meter-fill${sum > budget ? ' over' : ''}`} style={{ width: `${Math.min(100, (sum / budget) * 100)}%` }} />
            </div>
            <p className="muted small">
              {sum > budget ? `⚠️ 超出預算 ${formatTWD(sum - budget)}` : `預算剩餘 ${formatTWD(budget - sum)}`}（總預算 {formatTWD(budget)}）
            </p>
          </>
        )}
        {pending > 0 && <p className="muted small">有 {pending} 筆待確認</p>}
      </section>

      {transactions.length === 0 ? (
        <p className="empty">這個月還沒有紀錄，點右下角的 ＋ 新增第一筆吧！</p>
      ) : (
        groupByDay(transactions).map((g) => (
          <section key={g.day} className="day-group">
            <h3 className="day">{g.day}<span>{formatTWD(total(g.items))}</span></h3>
            <ul className="tx-list">
              {g.items.map((t) => {
                const c = categories.find((x) => x.id === t.category_id)
                return (
                  <li key={t.id}>
                    <button className="tx" onClick={() => onEdit(t)}>
                      <span className="tx-icon" aria-hidden>{c?.icon ?? '❔'}</span>
                      <span className="tx-main">
                        <span className="tx-title">{t.merchant || c?.name || '未分類'}</span>
                        <span className="tx-sub">
                          {t.merchant ? c?.name ?? '未分類' : ''}{t.note ? `${t.merchant ? ' · ' : ''}${t.note}` : ''}
                        </span>
                      </span>
                      <span className="tx-amount">
                        {t.status === 'pending' ? <span className="badge">待確認</span> : formatTWD(t.amount ?? 0)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))
      )}
    </>
  )
}
