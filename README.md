# 日文單字卡 Japanese Learning App

類 Quizlet 的日文學習單字卡 Web App（Vue 3 + Vite + TypeScript）。開發計畫見 [plan.md](plan.md)。

## 開發環境

需要 Node.js 20 以上（建議 22 LTS）。

```bash
npm install      # 安裝套件
npm run dev      # 啟動開發伺服器
npm test         # 執行單元測試
npm run lint     # ESLint 檢查並自動修正
npm run build    # 型別檢查＋建置到 dist/
```

## 資料集

所有資料集放在 `data/` 目錄：

```
data/
├─ vocabulary/   # 單字
└─ grammar/      # 文法
```

格式說明見 [plan.md 第 4 節](plan.md#4-資料格式)。

## 部署

推送到 `main` 後，GitHub Actions 會自動建置並部署到 GitHub Pages。
第一次使用前，請到 repo 的 **Settings → Pages**，把 **Source** 設為 **GitHub Actions**。
