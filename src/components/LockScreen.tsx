import { useState } from 'react'
import { unlock, type LockSettings } from '../lib/lock'

export default function LockScreen({ settings, onUnlocked, onSignOut }: {
  settings: LockSettings; onUnlocked: () => void; onSignOut: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function tryUnlock() {
    setBusy(true)
    setError(null)
    try {
      if (await unlock(settings)) onUnlocked()
      else setError('驗證沒有通過，請再試一次')
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? '已取消或逾時，請再試一次' : `無法使用 Face ID：${(e as Error).message}`)
    }
    setBusy(false)
  }

  return (
    <main className="app lock">
      <div className="lock-icon" aria-hidden>🔒</div>
      <h1>我的記帳本</h1>
      <p className="muted">已上鎖</p>
      <button className="primary" disabled={busy} onClick={tryUnlock}>{busy ? '驗證中…' : '用 Face ID 解鎖'}</button>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="link" onClick={() => { if (confirm('登出後需要用 Email 與密碼重新登入，App 鎖也會一併關閉。')) onSignOut() }}>
        無法使用 Face ID？登出改用密碼登入
      </button>
    </main>
  )
}
