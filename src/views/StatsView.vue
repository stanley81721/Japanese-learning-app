<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'

import {
  MATURITY_LABELS,
  accuracyOf,
  dailySeries,
  maturityFor,
  niceTicks,
  streak,
  type Maturity,
} from '@/lib/stats'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { useStudySessionStore } from '@/stores/studySession'

const progress = useProgressStore()
const datasetsStore = useDatasetsStore()
const session = useStudySessionStore()
const { datasets, status: loadStatus } = storeToRefs(datasetsStore)
const { history } = storeToRefs(progress)

const now = Date.now()
const DAYS = 30

const today = computed(() => progress.statsFor(now))
const todayAccuracy = computed(() => accuracyOf(today.value))
const streakDays = computed(() => streak(history.value, now))
const series = computed(() => dailySeries(history.value, now, DAYS))
const hasHistory = computed(() => series.value.some((d) => d.reviews > 0))
const ticks = computed(() => niceTicks(Math.max(...series.value.map((d) => d.reviews))))
const axisMax = computed(() => ticks.value[ticks.value.length - 1]!)

const percent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`)

// 熟練度：依學習頁勾選的測驗方向計算，只列出有卡片的資料集
const MATURITY_KEYS = ['unseen', 'learning', 'young', 'mature'] as const
const maturityRows = computed(() =>
  datasets.value
    .map((dataset) => {
      const m = maturityFor(dataset, session.enabledModes, progress.cards)
      const total = MATURITY_KEYS.reduce((sum, k) => sum + m[k], 0)
      return { dataset, m, total }
    })
    .filter((row) => row.total > 0),
)

// 圖表共用的提示框
type ChartId = 'daily' | 'maturity'
const tip = ref<{
  chart: ChartId
  x: number
  y: number
  title: string
  lines: string[]
} | null>(null)

/** 提示框對齊到 anchor（長條頂端或區段）上方，並限制在圖表寬度內 */
function showTip(chart: ChartId, anchor: Element, title: string, lines: string[]) {
  const area = anchor.closest('.chart')!.getBoundingClientRect()
  const box = anchor.getBoundingClientRect()
  tip.value = {
    chart,
    x: Math.min(Math.max(box.left + box.width / 2 - area.left, 70), area.width - 70),
    y: box.top - area.top,
    title,
    lines,
  }
}

function dayTip(event: MouseEvent | FocusEvent, d: (typeof series.value)[number]) {
  const slot = event.currentTarget as HTMLElement
  // 有長條時對齊長條頂端，沒有時對齊整欄
  showTip('daily', slot.querySelector('.column') ?? slot, d.day, [
    `作答 ${d.reviews} 次`,
    `新卡 ${d.newCards} 張`,
    `正確率 ${percent(d.accuracy)}`,
  ])
}

function maturityTip(
  event: MouseEvent | FocusEvent,
  name: string,
  key: keyof Maturity,
  m: Maturity,
  total: number,
) {
  showTip('maturity', event.currentTarget as Element, name, [
    `${MATURITY_LABELS[key]} ${m[key]} 張（${percent(m[key] / total)}）`,
  ])
}

onMounted(() => datasetsStore.ensureLoaded())
</script>

<template>
  <section class="stats">
    <h1>統計</h1>

    <div class="tiles">
      <div class="tile">
        <div class="tile-label">今天作答</div>
        <div class="tile-value">{{ today.reviews }}</div>
      </div>
      <div class="tile">
        <div class="tile-label">今天正確率</div>
        <div class="tile-value">{{ percent(todayAccuracy) }}</div>
      </div>
      <div class="tile">
        <div class="tile-label">連續學習</div>
        <div class="tile-value">{{ streakDays }}<span class="unit">天</span></div>
      </div>
      <div class="tile">
        <div class="tile-label">已學卡片</div>
        <div class="tile-value">{{ progress.totalCards }}</div>
      </div>
    </div>

    <!-- 每日作答 -->
    <div class="panel">
      <h2>最近 {{ DAYS }} 天作答次數</h2>
      <p v-if="!hasHistory" class="muted small empty">還沒有學習紀錄，到「學習」頁開始吧。</p>
      <template v-else>
        <div class="chart daily" @mouseleave="tip = null">
          <div class="plot">
            <div
              v-for="t in ticks"
              :key="t"
              class="gridline"
              :style="{ bottom: `${(t / axisMax) * 100}%` }"
            >
              <span class="tick">{{ t }}</span>
            </div>
            <div class="columns">
              <div
                v-for="d in series"
                :key="d.day"
                class="slot"
                tabindex="0"
                :aria-label="`${d.day}：作答 ${d.reviews} 次`"
                @mouseenter="dayTip($event, d)"
                @focus="dayTip($event, d)"
                @blur="tip = null"
              >
                <div
                  v-if="d.reviews > 0"
                  class="column"
                  :style="{ height: `${(d.reviews / axisMax) * 100}%` }"
                />
              </div>
            </div>
          </div>
          <div class="x-labels" aria-hidden="true">
            <span v-for="(d, i) in series" :key="d.day">
              {{ i % 7 === (DAYS - 1) % 7 ? d.label : '' }}
            </span>
          </div>
          <div
            v-if="tip?.chart === 'daily'"
            class="tooltip"
            :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
          >
            <strong>{{ tip.title }}</strong>
            <span v-for="line in tip.lines" :key="line">{{ line }}</span>
          </div>
        </div>

        <details class="table-view">
          <summary>表格檢視</summary>
          <table>
            <thead>
              <tr>
                <th>日期</th>
                <th>作答</th>
                <th>新卡</th>
                <th>正確率</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in series.filter((s) => s.reviews > 0).reverse()" :key="d.day">
                <td>{{ d.day }}</td>
                <td>{{ d.reviews }}</td>
                <td>{{ d.newCards }}</td>
                <td>{{ percent(d.accuracy) }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </template>
    </div>

    <!-- 熟練度 -->
    <div class="panel">
      <h2>各資料集熟練度</h2>
      <p class="muted small">依「學習」頁勾選的測驗方向計算，每個方向算一張卡。</p>
      <p v-if="loadStatus !== 'ready'" class="muted small">載入中…</p>
      <template v-else-if="maturityRows.length">
        <ul class="legend" aria-label="圖例">
          <li v-for="k in MATURITY_KEYS" :key="k">
            <span class="swatch" :class="k" />{{ MATURITY_LABELS[k] }}
          </li>
        </ul>
        <div class="chart maturity" @mouseleave="tip = null">
          <div v-for="{ dataset, m, total } in maturityRows" :key="dataset.id" class="maturity-row">
            <div class="row-label">
              <span>{{ dataset.name }}</span>
              <span class="muted small">已熟記 {{ percent(m.mature / total) }}</span>
            </div>
            <div class="stack">
              <template v-for="k in MATURITY_KEYS" :key="k">
                <div
                  v-if="m[k] > 0"
                  class="segment"
                  :class="k"
                  tabindex="0"
                  :style="{ flexGrow: m[k] }"
                  :aria-label="`${dataset.name} ${MATURITY_LABELS[k]} ${m[k]} 張`"
                  @mouseenter="maturityTip($event, dataset.name, k, m, total)"
                  @focus="maturityTip($event, dataset.name, k, m, total)"
                  @blur="tip = null"
                />
              </template>
            </div>
          </div>
          <div
            v-if="tip?.chart === 'maturity'"
            class="tooltip"
            :style="{ left: `${tip.x}px`, top: `${tip.y}px` }"
          >
            <strong>{{ tip.title }}</strong>
            <span v-for="line in tip.lines" :key="line">{{ line }}</span>
          </div>
        </div>

        <details class="table-view">
          <summary>表格檢視</summary>
          <table>
            <thead>
              <tr>
                <th>資料集</th>
                <th v-for="k in MATURITY_KEYS" :key="k">{{ MATURITY_LABELS[k] }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="{ dataset, m } in maturityRows" :key="dataset.id">
                <td>{{ dataset.name }}</td>
                <td v-for="k in MATURITY_KEYS" :key="k">{{ m[k] }}</td>
              </tr>
            </tbody>
          </table>
        </details>
      </template>
      <p v-else class="muted small">沒有可統計的資料集。</p>
    </div>
  </section>
</template>

<style scoped>
.stats {
  max-width: 760px;
  margin: 0 auto;
}

h1 {
  margin-top: 0;
}

.muted {
  color: var(--color-text-muted);
}

.small {
  font-size: 0.875rem;
}

.empty {
  padding: 1.5rem 0;
  text-align: center;
}

/* 數字卡 */
.tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
  margin-bottom: 1rem;
}

@media (max-width: 560px) {
  .tiles {
    grid-template-columns: repeat(2, 1fr);
  }
}

.tile {
  padding: 0.875rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.tile-label {
  color: var(--color-text-muted);
  font-size: 0.8125rem;
}

.tile-value {
  font-size: 1.75rem;
  font-weight: 600;
}

.unit {
  margin-left: 0.125rem;
  font-size: 0.875rem;
  font-weight: normal;
}

/* 圖表共用 */
.chart {
  position: relative;
}

.tooltip {
  position: absolute;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding: 0.375rem 0.625rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-surface);
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.12);
  color: var(--color-text);
  font-size: 0.8125rem;
  white-space: nowrap;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 6px));
}

.tooltip span {
  color: var(--color-text-muted);
}

/* 每日作答：直條圖 */
.plot {
  position: relative;
  height: 160px;
  margin-left: 2rem;
  border-bottom: 1px solid var(--color-text-muted);
}

.gridline {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 1px solid var(--color-border);
}

.tick {
  position: absolute;
  right: calc(100% + 0.375rem);
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  transform: translateY(-50%);
}

.columns {
  position: absolute;
  inset: 0;
  display: flex;
  gap: 2px;
}

.slot {
  display: flex;
  flex: 1;
  align-items: flex-end;
  justify-content: center;
  outline: none;
}

.slot:hover,
.slot:focus-visible {
  background: var(--color-hover);
}

.column {
  width: 100%;
  max-width: 16px;
  min-height: 2px;
  border-radius: 4px 4px 0 0;
  background: var(--viz-series);
}

.x-labels {
  display: flex;
  gap: 2px;
  margin-left: 2rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.x-labels span {
  flex: 1;
  overflow: visible;
  white-space: nowrap;
}

/* 熟練度：堆疊橫條 */
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem 1rem;
  margin: 0 0 0.75rem;
  padding: 0;
  font-size: 0.8125rem;
  list-style: none;
}

.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.maturity-row + .maturity-row {
  margin-top: 0.875rem;
}

.row-label {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.25rem;
  font-size: 0.875rem;
}

.stack {
  display: flex;
  gap: 2px;
  height: 16px;
}

.segment {
  flex-basis: 0;
  min-width: 4px;
  outline: none;
}

.segment:first-child {
  border-radius: 4px 0 0 4px;
}

.segment:last-child {
  border-radius: 0 4px 4px 0;
}

.segment:only-child {
  border-radius: 4px;
}

.segment:hover,
.segment:focus-visible {
  filter: brightness(1.1);
  box-shadow:
    0 0 0 2px var(--color-surface),
    0 0 0 3px var(--color-text-muted);
}

.unseen {
  background: var(--viz-unseen);
}

.learning {
  background: var(--viz-step-1);
}

.young {
  background: var(--viz-step-2);
}

.mature {
  background: var(--viz-step-3);
}

/* 表格檢視 */
.table-view {
  margin-top: 1rem;
  font-size: 0.875rem;
}

.table-view summary {
  color: var(--color-primary);
  cursor: pointer;
}

.table-view table {
  width: 100%;
  margin-top: 0.5rem;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.table-view th,
.table-view td {
  padding: 0.375rem 0.5rem;
  border-bottom: 1px solid var(--color-border);
  text-align: right;
}

.table-view th:first-child,
.table-view td:first-child {
  text-align: left;
}
</style>
