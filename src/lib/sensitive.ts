// 防呆：偵測像完整卡號或銀行帳號的長數字（10 碼以上，忽略空白與減號）
// 資料庫也有相同的檢查（public.has_long_number），這裡是為了在送出前就給清楚的提示
export function hasLongNumber(text: string | null | undefined): boolean {
  return !!text && /\d{10,}/.test(text.replace(/[\s-]/g, ''))
}

export const SENSITIVE_HINT = '看起來像完整的帳號或卡號。為了安全，請只填末 4 碼或暱稱。'
