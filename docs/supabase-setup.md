# Supabase 設定教學（第 3 階段）

## 🔐 先認識 Supabase 的金鑰
| 名稱 | 長相 | 可以公開嗎？ | 放哪裡 |
|---|---|---|---|
| Project URL | `https://xxxx.supabase.co` | ✅ 可以 | GitHub Variables |
| anon / publishable key | `eyJ...`（anon）或 `sb_publishable_...` | ✅ 可以，本來就會出現在網頁裡 | GitHub Variables |
| **service_role / secret key** | `eyJ...`（service_role）或 `sb_secret_...` | ❌ **絕對不行** | 只放在 Supabase 後端，不要貼到任何地方 |
| **資料庫密碼** | 建立專案時設定的 | ❌ **絕對不行** | 自己的密碼管理器 |

anon key 可以公開，是因為資料庫有 RLS（Row Level Security）規則：沒登入的人什麼都讀不到，登入的人只能讀自己的資料。
App 也有防呆：若誤把 secret key 設進去，建置後的網頁會直接報錯，不會正常運作。

## 步驟 1：建立資料表
1. Supabase 後台 → 左側 **SQL Editor** → **New query**
2. 把 `supabase/migrations/001_init.sql` 的內容整份貼上 → **Run**
3. 看到 `Success. No rows returned` 就完成了

## 步驟 2：讓登入信寄「驗證碼」
iPhone 主畫面的 App 和 Safari 是分開的，所以我們用「輸入驗證碼」登入，而不是點信中的連結。
1. **Authentication → Emails（Email Templates）**
2. 分別打開 **Magic Link** 和 **Confirm signup** 兩個範本，把內容換成：
   ```html
   <h2>記帳 App 登入驗證碼</h2>
   <p>你的驗證碼是：<strong>{{ .Token }}</strong></p>
   <p>如果不是你本人操作，請忽略這封信。</p>
   ```
3. 儲存。

## 步驟 3：把連線設定放進 GitHub
1. Supabase：**Project Settings → API**（或 **Data API / API Keys**），找到 **Project URL** 和 **anon public**（或 **publishable**）金鑰。
2. GitHub：repo → **Settings → Secrets and variables → Actions → Variables** 分頁 → **New repository variable**，新增兩個：
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable 金鑰
3. 到 **Actions** 分頁 → **Deploy to GitHub Pages** → **Run workflow**，重新部署。

## 步驟 4：登入後關閉註冊（重要）
這是個人 App，第一次用自己的 Email 登入成功後：
**Authentication → Sign In / Providers（或 Settings）→ 關閉「Allow new users to sign up」**。
這樣即使別人知道網址，也無法註冊帳號。
