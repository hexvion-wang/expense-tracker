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

### 之後新增的 migration
每個新的 `supabase/migrations/00X_*.sql` 都要依序在 SQL Editor 執行一次（已執行過的不要重複執行）：
| 檔案 | 內容 |
|---|---|
| `001_init.sql` | 分類、規則、交易 |
| `002_accounts.sql` | 資產帳戶、餘額校正、規則與交易可指定帳戶 |

## 步驟 2：建立你的登入帳號
Supabase 免費方案若沒有設定自訂 SMTP，無法修改登入信範本，所以 App 改用「Email + 密碼」登入，帳號直接在後台建立：
1. **Authentication → Users → Add user → Create new user**
2. 填入 Email 與一組**強密碼**（建議讓 iPhone「密碼」App 產生並儲存），勾選 **Auto Confirm User**
3. **Create user**

🔐 這組密碼只有你自己知道，不要貼到對話、GitHub 或任何地方。

## 步驟 3：把連線設定放進 GitHub
1. Supabase：**Project Settings → API**（或 **Data API / API Keys**），找到 **Project URL** 和 **anon public**（或 **publishable**）金鑰。
2. GitHub：repo → **Settings → Secrets and variables → Actions → Variables** 分頁 → **New repository variable**，新增兩個：
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable 金鑰
3. 到 **Actions** 分頁 → **Deploy to GitHub Pages** → **Run workflow**，重新部署。

## 步驟 4：關閉註冊（重要）
帳號建立好後：**Authentication → Sign In / Providers → 關閉「Allow new users to sign up」→ Save**。
App 沒有註冊畫面，但 anon key 是公開的，關閉註冊才能確保別人無法用 API 自己建立帳號。

## 🔐 安全檢查清單
- [ ] GitHub 帳號開啟兩步驟驗證（Settings → Password and authentication）
- [ ] Supabase 帳號開啟兩步驟驗證（右上角頭像 → Account preferences → Multi-factor authentication）
- [ ] Supabase 已關閉「Allow new users to sign up」
- [ ] App 內開啟「App 鎖（Face ID）」
- [ ] 每月做一次「完整備份」，檔案存在自己的 iCloud／檔案 App
- [ ] 資產帳戶只存暱稱、末 4 碼與餘額，不存完整帳號、卡號、CVV 或密碼
