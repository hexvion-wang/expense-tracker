import { addMonths, currentMonth, monthLabel, type Month } from '../lib/money'

export default function MonthSwitcher({ month, onChange }: { month: Month; onChange: (m: Month) => void }) {
  const now = currentMonth()
  const isCurrent = month.year === now.year && month.month === now.month
  return (
    <div className="month-switcher">
      <button className="icon-btn" aria-label="上個月" onClick={() => onChange(addMonths(month, -1))}>‹</button>
      <span>{monthLabel(month)}</span>
      <button className="icon-btn" aria-label="下個月" disabled={isCurrent} onClick={() => onChange(addMonths(month, 1))}>›</button>
    </div>
  )
}
