# 今日事今日畢，Today Job To Do List

> 本機任務追蹤儀表板，適合小型團隊分工與期限管理。
> A local task dashboard for small team task tracking and deadline management.

---

## Demo

**[https://todayjob-todolist-demo.vercel.app](https://todayjob-todolist-demo.vercel.app)**

---

## 功能特色 Features

- **新增 / 編輯 / 刪除工作** — 廠商名稱、專案編號、專案名稱、工作類別、期限、備註、連結欄位
- **看板模式** — 主管派工（全覽）、專案業務、專案執行，三種視角切換
- **工作狀態** — 未開始、進行中、待確認、已完成
- **工作層級（艾森豪矩陣）** — 緊急而且重要 / 緊急但不重要 / 重要但不緊急 / 不重要不緊急
- **期限提醒燈號** — 綠 / 黃 / 橘 / 紅 / 已逾期，一眼辨識風險
- **表格欄位排序** — 點擊欄位標題排序，再點一次反向
- **多維度篩選** — 狀態、專案業務、專案執行、工作類別、工作層級
- **設定名單** — 可新增、編輯、移除人員（含 Email）與工作類別
- **Email 通知模板** — 複製模板或開啟本機郵件草稿，通知紀錄自動寫入資料庫
- **分享連結** — `?view=executor&person=Eason` 可直接開啟指定人員看板
- **本地優先** — 預設使用 SQLite 本機資料庫，無需帳號、無需網路

---

## 技術架構 Tech Stack

| 層級 | 技術 |
|---|---|
| 框架 | Next.js 15 (App Router) |
| 語言 | TypeScript |
| 樣式 | Tailwind CSS |
| 資料庫 | libSQL / SQLite（本機）、Turso（雲端） |
| 部署 | Vercel |

---

## 本機啟動 Local Setup

### 環境需求

- Node.js 18+
- npm

### 安裝與啟動

```bash
# 1. Clone 專案
git clone https://github.com/你的帳號/today-job-to-do-list.git
cd today-job-to-do-list

# 2. 安裝相依套件
npm install

# 3. 建置
npm run build

# 4. 啟動（本機預設使用 SQLite，不需要設定任何環境變數）
npm run start -- --hostname 127.0.0.1 --port 3000
```

開啟瀏覽器：`http://127.0.0.1:3000`

第一次啟動時，系統會自動建立 SQLite 資料庫並填入預設工作類別。

### 開發模式

```bash
npm run dev
```

---

## 環境變數 Environment Variables

本機開發不需要設定任何環境變數，預設使用本機 SQLite 資料庫。

上雲端（Vercel + Turso）時才需要：

```bash
cp .env.example .env.local
```

| 變數 | 說明 | 必填 |
|---|---|---|
| `LIBSQL_URL` | Turso 資料庫連線 URL | 雲端必填 |
| `LIBSQL_AUTH_TOKEN` | Turso 驗證 Token | 雲端必填 |
| `BASIC_AUTH_USER` | Basic Auth 帳號（留空則不啟用） | 選填 |
| `BASIC_AUTH_PASS` | Basic Auth 密碼（留空則不啟用） | 選填 |
| `RESEND_API_KEY` | Email 自動寄送（第三版功能） | 選填 |

---

## 部署到 Vercel Deployment

### 1. 建立 Turso 資料庫（免費方案）

```bash
brew install tursodatabase/tap/turso
turso auth login
turso db create today-job-demo
turso db show today-job-demo      # 取得 LIBSQL_URL
turso db tokens create today-job-demo  # 取得 LIBSQL_AUTH_TOKEN
```

### 2. 部署到 Vercel

1. 前往 [vercel.com](https://vercel.com)，以 GitHub 帳號登入
2. Import 此 repository，Framework Preset 會自動偵測為 Next.js
3. 在 Environment Variables 填入 `LIBSQL_URL` 與 `LIBSQL_AUTH_TOKEN`
4. 點 Deploy

### 為什麼不用 GitHub Pages？

GitHub Pages 只支援靜態網站，無法執行 Next.js API Routes 與資料庫操作，因此不適用於此專案。

---

## 資料說明 Data Notice

此為公開展示版。展示資料（廠商名稱、人員代號等）均為虛構，不含任何真實專案或個人資訊。

本機資料庫（`data/today-job-to-do-list.db`）已透過 `.gitignore` 排除於版本控管之外，不會隨程式碼上傳至 GitHub。

---

## 授權 License

MIT License — 歡迎自由使用、修改、衍生。
