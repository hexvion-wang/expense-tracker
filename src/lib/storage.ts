// localStorage 只用來存「這台裝置」的小設定；在私密瀏覽或被清除時可能讀不到，所以全部包 try/catch
export function getItem(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
export function setItem(key: string, value: string | null): void {
  try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch { /* 忽略 */ }
}
