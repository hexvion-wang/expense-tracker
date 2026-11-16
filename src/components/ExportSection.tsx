import { useState } from 'react'
import type { Account, Category, Transaction } from '../lib/types'
import { fetchBackupData, listAllTransactions } from '../lib/api'
import { makeBackup, saveFile, stamp, transactionsToCsv } from '../lib/export'
import { backupOverdue, lastBackupAt, markBackedUp, REMIND_AFTER_DAYS } from '../lib/backupReminder'
import { monthLabel, type Month } from '../lib/money'

interface Props { month: Month; monthTransactions: Transaction[]; categories: Category[]; accounts: Account[] }

export default function ExportSection({ month, monthTransactions, categories, accounts }: Props) {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [last, setLast] = useState(lastBackupAt())

  async function run(task: () => Promise<string>) {
    setBusy(true)
    setStatus(null)
    try { setStatus(await task()) } catch (e) { setStatus(`失敗：${(e as Error).message}`) }
    setBusy(false)
  }

  const result = (r: string, what: string) => (r === 'cancelled' ? '已取消' : `${what}已產生`)
  const mm = String(month.month).padStart(2, '0')

  return (
    <section className="card">
      <h2>匯出與備份</h2>
      <p className={`small ${backupOverdue(last) ? 'warn' : 'muted'}`}>
        {last ? `上次完整備份：${last.toLocaleDateString('zh-TW')}` : '這台裝置還沒有做過完整備份'}
        {backupOverdue(last) && `（建議每 ${REMIND_AFTER_DAYS} 天備份一次）`}
      </p>
      <div className="stack">
        <button className="secondary" disabled={busy} onClick={() => run(async () =>
          result(await saveFile(`記帳_${month.year}${mm}.csv`, transactionsToCsv(monthTransactions, categories, accounts), 'text/csv'), `${monthLabel(month)} CSV `))}>
          📄 匯出 {monthLabel(month)}（CSV）
        </button>
        <button className="secondary" disabled={busy} onClick={() => run(async () => {
          const all = await listAllTransactions()
          return result(await saveFile(`記帳_全部_${stamp()}.csv`, transactionsToCsv(all, categories, accounts), 'text/csv'), `全部 ${all.length} 筆 CSV `)
        })}>
          📄 匯出全部紀錄（CSV）
        </button>
        <button className="secondary" disabled={busy} onClick={() => run(async () => {
          const backup = makeBackup(await fetchBackupData())
          const r = await saveFile(`記帳備份_${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json')
          if (r !== 'cancelled') { markBackedUp(); setLast(lastBackupAt()) }
          return result(r, '完整備份')
        })}>
          🗄️ 完整備份（JSON）
        </button>
      </div>
      {busy && <p className="muted small">處理中…</p>}
      {status && <p className="muted small" role="status">{status}</p>}
      <p className="muted small">
        CSV 可用 Excel、Numbers 或 Google 試算表開啟；完整備份包含分類、帳戶、規則與所有紀錄。<br />
        🔐 匯出的檔案是未加密的明文，請存在自己的「檔案」App 或 iCloud，不要傳到群組、公開雲端或 GitHub。
      </p>
    </section>
  )
}
