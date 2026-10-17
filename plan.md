# 日文單字卡 App 開發計畫

> 類 Quizlet 的日文學習單字卡 Web App，支援「單字」與「文法」兩種資料集、間隔重複記憶演算法、洗牌，以及瀏覽器端進度儲存。

---

## 1. 目標與範圍

### 1.1 目標
- 純前端 Web App（無後端），部署在 GitHub Pages。
- 支援 PWA 離線模式：安裝到手機主畫面後，沒有網路也能學習。
- 介面使用繁體中文。
- 從 `data/` 目錄載入 JSON 資料集，依 `category`（vocabulary / grammar）與 `level`（N5–N1）篩選；可勾選多份資料集一起學習。
- 提供多種測驗方向（漢字→中文、平假名→中文、中文→日文、文法例句挖空…）。
- 三種作答方式（翻卡自評、選擇題、輸入作答）每題隨機出現。
- 使用間隔重複（SRS）演算法安排複習，並搭配洗牌機制。
- 日文發音（TTS）。
- 學習進度存在瀏覽器（localStorage / IndexedDB），可匯出／匯入備份。

### 1.2 非目標（第一版不做）
- 使用者帳號、雲端同步、多裝置同步
- 線上編輯資料集（資料以 JSON 檔維護）
- 語音辨識、手寫輸入

---

## 2. 技術選型

| 項目 | 選擇 | 理由 |
|---|---|---|
| 框架 | Vue 3（Composition API + `<script setup>`） | 需求指定 |
| 建置工具 | Vite | Vue 官方推薦，支援 `import.meta.glob` 載入 `data/` |
| 語言 | TypeScript | 資料格式、SRS 狀態型別化，減少錯誤 |
| 狀態管理 | Pinia | 管理資料集、學習階段、進度 |
| 路由 | Vue Router（hash mode） | GitHub Pages 靜態部署不需伺服器 rewrite |
| 樣式 | 原生 CSS + CSS 變數（或 UnoCSS / Tailwind，待定） | 支援深色模式與手機版 |
| Markdown | markdown-it（`html: false`） | 顯示 `full_explanation`；原始 HTML 一律轉義、危險連結被擋，所以不需要另外引入 DOMPurify |
| PWA／離線 | vite-plugin-pwa（Workbox） | 預先快取程式與 `data/` 的 JSON |
| 發音 | Web Speech API（`speechSynthesis`，`ja-JP`） | 瀏覽器內建，不需外部服務 |
| 測試 | Vitest（單元）＋ Playwright（E2E，選配） | SRS、洗牌、挖空邏輯需單元測試 |
| 資料驗證 | 自寫 schema 檢查腳本（或 zod） | 建置前檢查 JSON 格式與 id 重複 |
| 部署 | GitHub Actions → GitHub Pages | 與 repo 整合 |

---

## 3. 專案結構

```
Japanese-learning-app/
├─ data/                         # 所有資料集（JSON）
│  ├─ vocabulary/
│  │  ├─ n3-business.json
│  │  └─ n4-basic.json
│  └─ grammar/
│     └─ n3-grammar-01.json
├─ scripts/
│  └─ validate-data.ts           # 驗證 JSON 格式、id 唯一性
├─ src/
│  ├─ main.ts
│  ├─ App.vue
│  ├─ router/index.ts
│  ├─ types/                     # Dataset、Card、Progress 型別
│  ├─ data/loader.ts             # import.meta.glob 載入 data/
│  ├─ stores/
│  │  ├─ datasets.ts             # 資料集清單與篩選
│  │  ├─ progress.ts             # SRS 進度（持久化）
│  │  └─ session.ts              # 當前學習／測驗階段
│  ├─ lib/
│  │  ├─ srs.ts                  # 記憶演算法（純函式）
│  │  ├─ shuffle.ts              # Fisher–Yates 洗牌
│  │  ├─ queue.ts                # 建立學習佇列（到期卡＋新卡＋錯題重排）
│  │  ├─ quizModes.ts            # 各測驗模式的題目／答案產生
│  │  ├─ grammarMarkup.ts        # 例句標記解析（高亮／挖空）
│  │  └─ storage.ts              # 儲存層（含版本遷移、匯出匯入）
│  ├─ components/
│  │  ├─ Flashcard.vue           # 翻牌卡片
│  │  ├─ GradeButtons.vue        # 再一次／困難／良好／簡單
│  │  ├─ SentenceView.vue        # 例句高亮／挖空顯示
│  │  └─ DatasetFilter.vue
│  └─ views/
│     ├─ HomeView.vue            # 資料集選擇＋篩選＋今日到期數
│     ├─ StudyView.vue           # 翻卡學習（SRS）
│     ├─ QuizView.vue            # 測驗模式
│     ├─ BrowseView.vue          # 瀏覽／搜尋整份資料集
│     ├─ StatsView.vue           # 學習統計
│     └─ SettingsView.vue        # 設定、匯出／匯入、重置
├─ tests/
├─ index.html
├─ vite.config.ts
└─ package.json
```

---

## 4. 資料格式

### 4.1 單字（vocabulary）— 依需求

```json
{
  "name": "N3 商業單字",
  "category": "vocabulary",
  "level": "N3",
  "data": [
    {
      "id": "n3-biz-001",
      "japanese": "株式",
      "hiragana": "かぶしき",
      "simple_chinese": "股份",
      "full_explanation": "...."
    }
  ]
}
```

欄位規則：
- `simple_chinese`：簡短的中文意思（繁體中文）。
- `full_explanation`：完整解釋，選填，支援 Markdown。
- 沒有漢字的單字（片假名外來語、純平假名詞）：`japanese` 直接填日文原文（例如 `コーヒー`），`hiragana` 可省略或填相同內容。
  - 「漢字→中文」模式顯示 `japanese`。
  - 「平假名→中文」模式顯示 `hiragana`，沒有則改顯示 `japanese`。
  - 答案面若 `japanese` 與 `hiragana` 相同，只顯示一次。

### 4.2 文法（grammar）— 使用 `examples` 結構化例句

原始格式中例句放在 `full_explanation` 的自由文字裡，程式無法可靠地「高亮文法」或「挖空」。
（文法常會變形，例如 `うちに` 在例句中可能是 `ないうちに`、`熱いうちに`，單純字串比對不可靠。）

因此新增選填欄位 `examples`，用 `【】` 標記文法部分：

```json
{
  "name": "N3 文法 01",
  "category": "grammar",
  "level": "N3",
  "data": [
    {
      "id": "n3-gram-001",
      "japanese": "うちに",
      "simple_chinese": "在～過程中／趁～",
      "full_explanation": "表示在某狀態持續期間做某事……",
      "examples": [
        {
          "sentence": "若い【うちに】いろいろな経験をしたほうがいい。",
          "translation": "趁年輕的時候最好多累積各種經驗。"
        }
      ]
    }
  ]
}
```

- 高亮模式：`【うちに】` → `<mark>うちに</mark>`
- 挖空模式：`【うちに】` → `＿＿＿＿`，答案為括號內文字
- 沒有 `examples` 的條目自動略過「例句」相關測驗模式
- 有多個例句時，每次出題隨機挑一個（記憶進度仍以「項目＋測驗方向」計算）
- 一個例句可以有多個【】；挖空題的答案依序連接，例如 `さえ…ば`

### 4.2.1 資料集層級的選填欄位
- `series`：系列名稱。同一系列拆成多個檔案（例如每 100 個單字一份）時，首頁可用「系列」篩選後一次全選。
- `source`：資料來源與授權說明，顯示在「瀏覽」頁。

### 4.3 資料集識別
- 資料集 ID 由檔案路徑產生（例如 `vocabulary/n3-business`），不需在 JSON 內另外寫。
- 卡片唯一鍵 = `資料集ID + item.id`，避免不同資料集 id 衝突。
- `scripts/validate-data.ts` 在 `npm run build` 前執行：檢查必填欄位、`category`／`level` 合法值、同一資料集內 id 不重複、例句 `【】` 成對。

### 4.4 載入方式
使用 Vite `import.meta.glob('/data/**/*.json', { import: 'default' })`：
- 新增 JSON 檔不需維護索引清單，重新建置即可。
- 每個 JSON 檔打包成獨立 chunk，不塞進主程式；首頁開啟時並行載入全部資料集（首頁需要顯示每份的筆數）。
- 載入時用與 `validate-data` 相同的驗證函式（`src/lib/validateDataset.ts`）；格式錯誤的檔案會被略過，並在首頁顯示錯誤。

---

## 5. 測驗模式

以 `QuizMode` 定義每種「題目面 → 答案面」：

### 5.1 單字
| 模式 ID | 題目 | 答案 |
|---|---|---|
| `vocab-kanji-to-zh` | 漢字（`japanese`） | 中文（＋平假名、完整解釋） |
| `vocab-kana-to-zh` | 平假名（`hiragana`） | 中文（＋漢字、完整解釋） |
| `vocab-zh-to-jp` | 中文 | 漢字＋平假名（完整解釋可切換顯示） |

使用者設定「日文顯示方式」：漢字／平假名／漢字＋振假名（ruby）。

### 5.2 文法
| 模式 ID | 題目 | 答案 |
|---|---|---|
| `grammar-pattern-to-zh` | 文法（`japanese`） | 中文 |
| `grammar-sentence-to-zh` | 例句（文法高亮） | 中文（＋例句翻譯） |
| `grammar-zh-to-pattern` | 中文 | 文法（完整解釋可切換顯示） |
| `grammar-cloze` | 例句挖空＋例句中文翻譯 | 被挖空的文法（完整內容選填） |

### 5.3 作答方式（每題隨機）
不設預設值，每出一題時從可用的作答方式中隨機選一種：

- **翻卡自評**（類 Anki）：看題目 → 翻面 → 自評 再一次／困難／良好／簡單
- **選擇題**（類 Quizlet Learn）：四選一，從目前選取的資料集中抽 3 個同類型的干擾選項（避免與正解重複）
- **輸入作答**：輸入答案後比對
  - 只用在答案是日文的題目（中文→日文、文法挖空）。中文答案的寫法太多，無法可靠比對。
  - 比對時忽略空白、全形半形；漢字或平假名任一個對就算對。
  - 答錯時可按「我其實答對了」覆蓋判定（避免同義寫法被判錯）。

隨機規則：
- 題目不適用某種方式時，從其餘方式中選（例如中文答案的題目不出輸入題；干擾選項不足 3 個時不出選擇題）。
- 設定頁可關閉某種作答方式，但預設三種都開。

---

## 6. 記憶演算法與洗牌

### 6.1 SRS：簡化版 SM-2
每張卡**每個測驗方向**各自一筆進度（「漢字→中文」會了不代表「中文→日文」會）：

```ts
interface CardProgress {
  key: string            // `${datasetId}:${itemId}:${modeId}`
  state: 'new' | 'learning' | 'review' | 'relearning'
  ease: number           // 預設 2.5，下限 1.3
  interval: number       // 天
  due: number            // timestamp
  reps: number
  lapses: number
  lastReviewed: number
}
```

評分規則：
| 評分 | 效果 |
|---|---|
| 再一次 | 進入 relearning，interval 重設，ease −0.2，本次學習中稍後再出現 |
| 困難 | interval × 1.2，ease −0.15 |
| 良好 | interval × ease |
| 簡單 | interval × ease × 1.3，ease +0.15 |

學習中步驟（learning steps）：1 分鐘 → 10 分鐘 → 畢業（1 天）。

選擇題與輸入題沒有自評按鈕，自動換算評分：答錯 → 再一次；答對 → 良好。
`srs.ts` 寫成純函式 `schedule(progress, grade, now) => progress`，方便單元測試；未來可替換為 FSRS。

### 6.2 學習佇列與洗牌
1. 取出所有到期的卡：學習中的卡要 `due <= now`；複習卡只要今天內到期就算
2. 加入新卡，數量受「每日新卡上限」限制（預設 20）；每個項目一次只挑一個還沒學過的方向，且已有到期卡的項目不再加新方向
3. 以 Fisher–Yates 洗牌混合新卡與複習卡
4. 答錯的卡插回佇列後方 3–5 張的位置，而非立即重複
5. 「自由練習」模式：不受 SRS 限制，整份資料集洗牌練習，可選擇不寫入 SRS 進度
6. 多資料集混合學習：首頁可勾選多份資料集（或「全部 N3 單字」這類快捷選項），佇列從所有選取的資料集取卡；每日新卡上限以整個學習階段計算

---

## 7. 進度儲存

- 使用 `localStorage`（資料量小）；若進度筆數過大（> 數千筆）改用 IndexedDB（透過 `idb-keyval`）。
- 儲存內容：
  - `jla:v1:progress` — 所有 `CardProgress`
  - `jla:v1:settings` — 每日新卡數、顯示方式、作答方式、深色模式等
  - `jla:v1:history` — 每日複習次數與正確率（統計用）
- 含 schema 版本號，升級時執行遷移；讀到無法辨識的格式時不覆寫（避免清掉使用者的進度），並在學習頁顯示警告。
- 其他小型偏好也存在 localStorage：`selected-datasets`（已選資料集）、`study-modes`（勾選的測驗方向）。
- 設定頁提供：**匯出 JSON 備份**、**匯入備份**、**重置單一資料集進度**、**全部重置**。
  - 備份檔包含卡片進度、每日統計與設定（`format: japanese-learning-app-backup`）。
  - 匯入前完整驗證，任何一筆格式錯誤就整份拒絕；確認後才取代目前進度。
- 統計頁：今天作答數、正確率、連續學習天數、已學卡片數；最近 30 天作答直條圖；
  各資料集熟練度（未學／學習中／複習中／已熟記＝間隔 ≥ 21 天）。兩張圖都有滑鼠提示與表格檢視。
- 資料集內容更新時：已刪除的 id 進度保留但不顯示；新增的 id 視為新卡。

### 7.1 離線模式（PWA）
- `vite-plugin-pwa` 產生 manifest 與 Service Worker，可「加入主畫面」。
- 預先快取：程式、樣式、圖示，以及 `data/` 下所有 JSON（`import.meta.glob` 打包後的檔案）。
- 有新版本時顯示「有更新，重新載入」提示，避免舊快取一直不更新。
- 進度本來就存在瀏覽器，離線時照常讀寫。

### 7.2 發音（TTS）
- 使用 Web Speech API，語言設為 `ja-JP`；單字念 `hiragana`（沒有則念 `japanese`），文法例句念整句（去掉 `【】`）。
- 卡片上有喇叭按鈕（快捷鍵 `P`）；設定頁可開啟「翻面時自動發音」與調整語速。
- 題目本身是日文時（漢字／假名 → 中文、文法／例句 → 中文）正面就能朗讀；答案是日文時（中文 → 日文、挖空題）要翻面或作答後才能朗讀，以免洩漏答案。
- 優先使用裝置本機的 ja-JP 語音，離線時也能發音。
- 離線時能否發音取決於裝置是否有內建日文語音；偵測不到日文語音時隱藏按鈕並在設定頁提示。

---

## 8. 頁面與功能

| 頁面 | 功能 |
|---|---|
| 首頁 | 依 category／level 篩選資料集；顯示每份資料集的新卡／到期／已學數量；可多選資料集合併學習 |
| 學習 | 選擇測驗模式 → 每題隨機作答方式（翻卡／選擇／輸入）；進度條；快捷鍵（空白鍵翻面、1–4 評分或選項）；發音按鈕 |
| 測驗 | 不寫入 SRS 的一次性測驗（作答方式同樣隨機）；結束後顯示成績與錯題清單 |
| 瀏覽 | 列表檢視整份資料集，可搜尋、看完整解釋 |
| 統計 | 每日複習量、正確率、各資料集熟練度分布 |
| 設定 | 偏好設定、匯出匯入、重置 |

---

## 9. 開發階段（里程碑）

| 階段 | 內容 | 產出 |
|---|---|---|
| **M0 專案建置** | Vite + Vue 3 + TS + Pinia + Router + ESLint/Prettier + Vitest；GitHub Actions 部署 | 可部署的空殼 |
| **M1 資料層** | 型別定義、`import.meta.glob` 載入、篩選、`validate-data` 腳本、範例資料集各一份 | 首頁可列出並篩選資料集 |
| **M2 翻卡** | Flashcard 元件、單字三種模式、Markdown 解釋、洗牌、多資料集混合、自由練習 | 可翻卡練習單字 |
| **M3 SRS 與儲存** | `srs.ts`、`queue.ts`、`storage.ts`、評分按鈕、每日上限 | 進度可保存，重開瀏覽器仍在 |
| **M4 作答方式** | 選擇題、輸入題、每題隨機選作答方式、成績頁 | 三種作答方式混合出題 |
| **M5 文法** | 例句標記解析、高亮與挖空、四種文法模式 | 文法學習完整 |
| **M6 統計與設定** | 統計頁、匯出匯入、重置、深色模式 | 完整設定與備份 |
| **M7 發音與離線** | TTS 發音、PWA（manifest、Service Worker、更新提示） | 可安裝、可離線 |
| **M8 打磨** | RWD 手機版、鍵盤快捷鍵、無障礙檢查 | v1.0 |

---

## 10. 測試策略
- **單元測試**：`srs.ts`（各評分的 interval／ease 變化）、`shuffle.ts`、`queue.ts`（每日上限、錯題重排）、`grammarMarkup.ts`（高亮／挖空）、`storage.ts`（遷移、匯入格式錯誤）
- **資料驗證**：CI 中執行 `validate-data`，格式錯誤時建置失敗
- **E2E（選配）**：選資料集 → 學習 → 評分 → 重新整理後進度仍在
- **無障礙**：`tests/a11y.spec.ts` 用 axe-core 檢查每個頁面與學習中畫面的結構；顏色對比在瀏覽器中用 axe 檢查（淺色與深色、手機寬度）
- **快捷鍵**：按 `?` 開啟快捷鍵說明；有跳到主要內容的連結；觸控裝置不顯示鍵盤提示

---

## 11. 已確認的決定

| # | 問題 | 決定 |
|---|---|---|
| 1 | 作答方式 | 翻卡自評、選擇題、輸入作答三種，每題隨機，不設預設（見 5.3） |
| 2 | 語言 | 介面與中文內容皆為繁體中文；`simple_chinese` 指簡短中文意思 |
| 3 | 文法例句格式 | 使用 `examples` ＋ `【】` 標記（見 4.2） |
| 4 | SRS 進度 | 每個測驗方向分開記錄 |
| 5 | 跨資料集學習 | 需要，可多選資料集混合學習 |
| 6 | 沒有漢字的單字 | `japanese` 直接填日文原文（見 4.1） |
| 7 | `full_explanation` | 支援 Markdown |
| 8 | 部署與離線 | GitHub Pages ＋ PWA 離線模式（見 7.1） |
| 9 | 發音 | 需要，使用 Web Speech API（見 7.2） |
