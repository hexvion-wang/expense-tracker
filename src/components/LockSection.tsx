import { useEffect, useState } from 'react'
import { enableLock, getLockSettings, isLockSupported, setLockSettings } from '../lib/lock'

const OPTIONS = [{ v: 0, label: '立即' }, { v: 1, label: '1 分鐘' }, { v: 5, label: '5 分鐘' }, { v: 30, label: '30 分鐘' }]

export default function LockSection({ email }: { email: string }) {
  const [settings, setSettings] = useState(getLockSettings())
  const [supported, setSupported] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [after, setAfter] = useState(settings?.afterMinutes ?? 1)

  useEffect(() => { isLockSupported().then(setSupported) }, [])

  async function turnOn() {
    setError(null)
    try {
      await enableLock(email, after)
      setSettings(getLockSettings())
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? '已取消' : `無法啟用：${(e as Error).message}`)
    }
  }

  function changeAfter(v: number) {
    setAfter(v)
    if (settings) { const s = { ...settings, afterMinutes: v }; setLockSettings(s); setSettings(s) }
  }

  return (
    <section className="card">
      <h2>App 鎖（Face ID）</h2>
      {supported === false ? (
        <p className="muted small">這台裝置或瀏覽器不支援 Face ID 解鎖。請在 iPhone 上從主畫面開啟 App 再設定。</p>
      ) : (
        <>
          <p className="muted small">打開 App 時要先用 Face ID 解鎖。只對這台裝置有效。</p>
          <div className="field">
            <span className="label">離開 App 多久後需要重新解鎖</span>
            <div className="chips">
              {OPTIONS.map((o) => (
                <button type="button" key={o.v} aria-pressed={after === o.v} className={`chip${after === o.v ? ' selected' : ''}`} onClick={() => changeAfter(o.v)}>{o.label}</button>
              ))}
            </div>
          </div>
          {settings ? (
            <button className="danger" onClick={() => { setLockSettings(null); setSettings(null) }}>關閉 App 鎖</button>
          ) : (
            <button className="secondary" disabled={supported == null} onClick={turnOn}>🔒 開啟 App 鎖</button>
          )}
          {settings && <p className="muted small">✅ 已開啟</p>}
          {error && <p className="error" role="alert">{error}</p>}
          <p className="muted small">開啟時 iPhone 會詢問是否儲存「通行密鑰」，請選「繼續」。它會存在你的 iCloud 鑰匙圈，不會傳到資料庫。</p>
        </>
      )}
    </section>
  )
}
