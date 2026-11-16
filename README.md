# 我的記帳本（expense-tracker）

個人用的記帳網頁 App（PWA）。可以在 iPhone 上「加入主畫面」，像一般 App 一樣使用，並搭配 iOS 捷徑自動記帳。

## 常用指令
| 指令 | 用途 |
|---|---|
| `npm install` | 安裝套件 |
| `npm run dev` | 啟動開發伺服器 |
| `npm test` | 執行測試 |
| `npm run build` | 建置正式版到 `dist/` |

## 部署
推送到 `main` 分支後，GitHub Actions（`.github/workflows/deploy.yml`）會自動測試、建置並部署到 GitHub Pages：
https://hexvion-wang.github.io/expense-tracker/
