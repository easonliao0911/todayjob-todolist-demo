# 今日事，今日畢 雲端第二版建議

## 第一版定位

第一版是本機工具：

- 使用 Next.js 網頁介面。
- 使用 `data/today-job-to-do-list.db` 保存本機資料。
- 不需要登入。
- 看板模式先採用 URL 參數與前端篩選，並非真正權限控管。
- Email 發送先不接，改用「Email 通知模板」與本機通知紀錄。

## 第二版免費雲端建議

GitHub 帳號足夠用來做版本控管與自動部署來源，但不建議用 GitHub 當工作資料庫。

建議組合：

| 層級 | 建議服務 | 原因 |
| --- | --- | --- |
| 程式碼 | GitHub | 版本控管、回復歷史版本、串接部署 |
| 網站部署 | Vercel Hobby | 支援 Next.js 與 API Routes，適合個人小型工具 |
| 雲端資料庫 | Turso Free | 與目前本機 libSQL/SQLite 技術路線接近，遷移成本低 |
| 設定資料協作 | Google Sheet，可選 | 適合維護人員名單、工作類別、品牌清單，不建議當主要任務資料庫 |

## 不建議只用 GitHub Pages 的原因

GitHub Pages 是靜態網站服務，適合展示頁、文件站、作品集；但這個工具需要新增、編輯、刪除工作資料，也需要 API 與資料庫，因此不適合只用 GitHub Pages。

## 第二版升級步驟

1. 將本機專案推到 GitHub repository。
2. 在 Turso 建立雲端資料庫。
3. 將本機 `file:` 資料庫連線抽成環境變數，新增 `TURSO_DATABASE_URL` 與 `TURSO_AUTH_TOKEN`。
4. 在 Vercel 匯入 GitHub repository。
5. 在 Vercel 設定環境變數。
6. 加入簡單登入或分享權限，避免公開網址被外部使用者修改資料。
7. 如需要多人維護固定選單，再接 Google Sheet 同步人員與類別。

## 官方參考

- GitHub Pages 說明：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Vercel Hobby Plan：https://vercel.com/docs/plans/hobby
- Turso Pricing：https://turso.tech/pricing

## Google Sheet 的建議角色

適合：

- 人員名單
- 工作類別
- 品牌清單
- 常用專案代碼對照

不適合：

- 每一筆工作任務的主要資料庫
- 頻繁多人同時編輯的任務狀態
- 權限與稽核要求較高的工作流程

原因是 Google Sheet 很容易被手動改壞格式，欄位型別也不嚴格。若第二版要穩定上雲端，任務主資料仍應放在正式資料庫。
