# 日文單字卡 Japanese Learning App

類 Quizlet 的日文學習單字卡 Web App（Vue 3 + Vite + TypeScript）。開發計畫見 [plan.md](plan.md)。

## 開發環境

需要 Node.js 20 以上（建議 22 LTS）。

```bash
npm install      # 安裝套件
npm run dev      # 啟動開發伺服器
npm test         # 執行單元測試
npm run lint     # ESLint 檢查並自動修正
npm run validate-data  # 檢查 data/ 下所有資料集格式
npm run build    # 驗證資料＋型別檢查＋建置到 dist/
```

## 資料集

所有資料集放在 `data/` 目錄：

```
data/
├─ vocabulary/   # 單字
└─ grammar/      # 文法
```

格式說明見 [plan.md 第 4 節](plan.md#4-資料格式)。新增檔案後執行 `npm run validate-data` 檢查格式；
格式錯誤時建置（以及 GitHub Actions 部署）會失敗。

### 資料來源與授權

- `data/vocabulary/n3-vocab-*.json`（1,806 個單字，分成 19 個檔案）：單字與讀音取自
  [tanos.co.uk](https://www.tanos.co.uk/jlpt/) 的 JLPT N3 單字表，由 Jonathan Waller 整理，以 Creative Commons BY 授權
  （經 [Bluskyo/JLPT_Vocabulary](https://github.com/Bluskyo/JLPT_Vocabulary) 轉成 CSV）。中文意思、用法說明與例句為本專案自行撰寫。
  - 已修正原始清單中的讀音錯誤、斷行與被截斷的詞形；同字同義的重複項目合併，不同意思的保留。
  - 單字的 `id`（`n3-tanos-0001`～`1806`）依清整後的清單順序編號；檔案內的順序則以固定種子打亂，
    每個檔案都混有各個讀音開頭的單字。
- `data/grammar/n3-grammar-*.json`（100 項）：文法項目參考 JLPT N3 常見文法，說明與例句為本專案自行撰寫。
- 每個資料集的 `source` 欄位也記錄了來源，會顯示在「瀏覽」頁。
- 介面測試使用 `tests/fixtures/data/` 的小型範例資料，不受正式資料增減影響。

資料集可以加上 `series`（系列）欄位，同系列拆成多個檔案時，首頁可以用「系列」一起篩選。

## 離線使用與發音

- 網站是 PWA：第一次開啟後會把程式和所有資料集下載到瀏覽器，之後沒有網路也能使用。
  在手機瀏覽器選「加入主畫面」即可像 App 一樣開啟。有新版本時會出現「重新載入」提示。
- 發音使用瀏覽器內建的語音（Web Speech API）。裝置沒有日文語音時不會顯示發音按鈕，
  可在作業系統的語言設定中安裝日文語音。

## 部署

推送到 `main` 後，GitHub Actions 會自動建置並部署到 GitHub Pages。
第一次使用前，請到 repo 的 **Settings → Pages**，把 **Source** 設為 **GitHub Actions**。
