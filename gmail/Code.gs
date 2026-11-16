/**
 * 記帳 App：Gmail 消費通知自動記帳
 *
 * 每 5 分鐘檢查一次 Gmail，把符合 QUERY 的「新」通知信內文送到記帳 App（存成待確認紀錄）。
 *
 * 安全設計：
 * - 只要求 Gmail「唯讀」權限（gmail.readonly），程式不能寄信、刪信或修改信件
 * - 只讀取符合 QUERY 的信，只送出信件「內文」，不送寄件人、收件人等其他資訊
 * - 網址、apikey、token 存在「指令碼屬性」，不寫在程式碼裡；請不要分享這個 Apps Script 專案
 */

// ====== 要抓哪些信：可以自行增加其他銀行（用 OR 連接） ======
// 範例：'(from:taipeifubon.com.tw "即時消費通知") OR (from:esunbank.com.tw "消費通知")'
const QUERY = '(from:taipeifubon.com.tw "即時消費通知")'

const MAX_PER_RUN = 20
const PROP_LAST = 'LAST_PROCESSED_MS' // 已處理到哪個時間點（毫秒）

/** 第一次設定時執行一次：檢查設定、從「現在」開始處理新信件、建立每 5 分鐘的排程 */
function setup() {
  readConfig_()
  const props = PropertiesService.getScriptProperties()
  props.setProperty(PROP_LAST, String(Date.now()))
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'processEmails' })
    .forEach(function (t) { ScriptApp.deleteTrigger(t) })
  ScriptApp.newTrigger('processEmails').timeBased().everyMinutes(5).create()
  console.log('✅ 設定完成：之後收到的消費通知信會每 5 分鐘自動送出一次')
}

/** 預覽：列出最近 7 天符合條件的信件與會送出的內文開頭，不會真的送出 */
function dryRun() {
  const ids = listMessageIds_(QUERY + ' newer_than:7d')
  console.log('最近 7 天符合條件的信件：' + ids.length + ' 封')
  ids.slice(0, 5).forEach(function (id) {
    const m = getMessage_(id)
    console.log('—— ' + new Date(m.time).toLocaleString('zh-TW') + '\n' + m.text.slice(0, 300))
  })
}

/** 排程會自動執行這個函式 */
function processEmails() {
  const cfg = readConfig_()
  const props = PropertiesService.getScriptProperties()
  const last = Number(props.getProperty(PROP_LAST) || Date.now())
  const afterSec = Math.floor(last / 1000) - 60 // Gmail 的 after: 以秒計，往前多抓 1 分鐘，再用毫秒精確比較

  const messages = listMessageIds_(QUERY + ' after:' + afterSec)
    .map(getMessage_)
    .filter(function (m) { return m.time > last })
    .sort(function (a, b) { return a.time - b.time })
    .slice(0, MAX_PER_RUN)

  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]
    const res = UrlFetchApp.fetch(cfg.url, {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: cfg.apikey },
      payload: JSON.stringify({ p_token: cfg.token, p_source: 'email', p_text: m.text.slice(0, 3500) }),
      muteHttpExceptions: true,
    })
    const code = res.getResponseCode()
    if (code !== 200) {
      // 失敗時停在這封，下次排程會重試；不把錯誤內容以外的資料寫進紀錄
      console.error('送出失敗（HTTP ' + code + '）：' + res.getContentText().slice(0, 200))
      return
    }
    props.setProperty(PROP_LAST, String(m.time))
  }
  if (messages.length) console.log('已送出 ' + messages.length + ' 封')
}

/** 停用自動記帳（刪除排程） */
function stop() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t) })
  console.log('已停止自動記帳')
}

// ---------------- 以下為內部函式 ----------------

function readConfig_() {
  const p = PropertiesService.getScriptProperties()
  const cfg = { url: p.getProperty('INGEST_URL'), apikey: p.getProperty('APIKEY'), token: p.getProperty('TOKEN') }
  if (!cfg.url || !cfg.apikey || !cfg.token) {
    throw new Error('請先到「專案設定 → 指令碼屬性」新增 INGEST_URL、APIKEY、TOKEN 三個屬性')
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/rest\/v1\/rpc\/ingest$/.test(cfg.url)) {
    throw new Error('INGEST_URL 格式不對，請從記帳 App「設定 → 捷徑自動記帳」複製網址')
  }
  if (/^sb_secret_/.test(cfg.apikey)) {
    throw new Error('APIKEY 填成 secret key 了！請改用 sb_publishable_ 開頭的公開金鑰，並到 Supabase 重新產生 secret key')
  }
  return cfg
}

function listMessageIds_(q) {
  const res = Gmail.Users.Messages.list('me', { q: q, maxResults: 50 })
  return (res.messages || []).map(function (m) { return m.id })
}

function getMessage_(id) {
  const msg = Gmail.Users.Messages.get('me', id, { format: 'full' })
  return { time: Number(msg.internalDate), text: extractText_(msg.payload) }
}

/** 取出信件內文：優先用純文字版本，沒有的話把 HTML 轉成文字 */
function extractText_(payload) {
  const plain = findPart_(payload, 'text/plain')
  if (plain) return normalize_(decode_(plain))
  const html = findPart_(payload, 'text/html')
  return html ? normalize_(htmlToText_(decode_(html))) : ''
}

function findPart_(part, mime) {
  if (!part) return null
  if (part.mimeType === mime && part.body && part.body.data) return part.body.data
  const parts = part.parts || []
  for (let i = 0; i < parts.length; i++) {
    const found = findPart_(parts[i], mime)
    if (found) return found
  }
  return null
}

function decode_(data) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(data)).getDataAsString('UTF-8')
}

function htmlToText_(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)) })
}

function normalize_(text) {
  return text.replace(/\r/g, '').replace(/[ \t　]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim()
}
