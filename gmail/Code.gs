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
  const clean = function (v) { return v == null ? '' : String(v).replace(/[\s\u200b\u3000]/g, '') }
  const cfg = { url: clean(p.getProperty('INGEST_URL')), apikey: clean(p.getProperty('APIKEY')), token: clean(p.getProperty('TOKEN')) }
  const missing = ['INGEST_URL', 'APIKEY', 'TOKEN'].filter(function (k, i) { return ![cfg.url, cfg.apikey, cfg.token][i] })
  if (missing.length) {
    throw new Error('指令碼屬性缺少：' + missing.join('、') + '（名稱要全大寫、一字不差）')
  }
  // 只要是 https://xxxx.supabase.co 開頭就接受，自動補成完整的投遞網址
  const base = cfg.url.match(/^https:\/\/[a-z0-9-]+\.supabase\.co(?=\/|$)/i)
  if (!base) {
    throw new Error('INGEST_URL 格式不對：應該是 https://（專案代碼）.supabase.co 開頭。目前開頭是「' + cfg.url.slice(0, 12) + '…」')
  }
  cfg.url = base[0].toLowerCase() + '/rest/v1/rpc/ingest'
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
  let text = ''
  try {
    text = extractText_(msg.payload)
  } catch (e) {
    console.error('信件 ' + id + ' 內文無法解析：' + e.message)
  }
  // 解析失敗時仍送出一筆提示，讓 App 顯示「待確認」，不會默默漏記
  return { time: Number(msg.internalDate), text: text || 'Gmail 消費通知信無法解析內文，請到 Gmail 查看這封信並手動填寫' }
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
  if (part.mimeType === mime && part.body && part.body.data) return part
  const parts = part.parts || []
  for (let i = 0; i < parts.length; i++) {
    const found = findPart_(parts[i], mime)
    if (found) return found
  }
  return null
}

/** 取得信件段落宣告的字元編碼（台灣銀行常用 Big5） */
function charsetOf_(part) {
  const headers = part.headers || []
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i].name).toLowerCase() === 'content-type') {
      const m = String(headers[i].value).match(/charset="?([\w-]+)"?/i)
      if (m) return m[1]
    }
  }
  return 'UTF-8'
}

/** 解碼內文：Apps Script 可能回傳位元組陣列，或是沒有補齊「=」的 base64url 字串 */
function decode_(part) {
  const data = part.body.data
  let bytes
  if (Array.isArray(data)) {
    bytes = data
  } else {
    let b64 = String(data).replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    bytes = Utilities.base64Decode(b64)
  }
  const charset = charsetOf_(part)
  try {
    return Utilities.newBlob(bytes).getDataAsString(charset)
  } catch (e) {
    return Utilities.newBlob(bytes).getDataAsString('UTF-8')
  }
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
