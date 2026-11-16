import { getItem, setItem } from './storage'

const KEY = 'last-backup-at'
export const REMIND_AFTER_DAYS = 30

export function lastBackupAt(): Date | null {
  const v = getItem(KEY)
  const d = v ? new Date(v) : null
  return d && !isNaN(d.getTime()) ? d : null
}

export function markBackedUp(now = new Date()): void {
  setItem(KEY, now.toISOString())
}

export function backupOverdue(last: Date | null, now = new Date()): boolean {
  return !last || now.getTime() - last.getTime() > REMIND_AFTER_DAYS * 86_400_000
}
