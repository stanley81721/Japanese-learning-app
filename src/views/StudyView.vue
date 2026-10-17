<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'

import FlashCard from '@/components/FlashCard.vue'
import GradeButtons from '@/components/GradeButtons.vue'
import { buildPracticeDeck } from '@/lib/deck'
import { buildStudyQueue, countDataset } from '@/lib/queue'
import { QUIZ_MODES, getQuizMode } from '@/lib/quizModes'
import type { Grade } from '@/lib/srs'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useStudySessionStore } from '@/stores/studySession'
import { CATEGORY_LABELS, type Category } from '@/types/dataset'

const datasetsStore = useDatasetsStore()
const progress = useProgressStore()
const settings = useSettingsStore()
const session = useStudySessionStore()
const { status: loadStatus, selectedDatasets, selectedItemCount } = storeToRefs(datasetsStore)
const { newCardsPerDay } = storeToRefs(settings)
const {
  mode,
  status,
  current,
  flipped,
  index,
  queue,
  remaining,
  enabledModes,
  studiedCount,
  reviewCount,
  knownCount,
  unknownCards,
  intervalPreview,
} = storeToRefs(session)

// 回到設定畫面時更新時間，讓到期數保持正確
const now = ref(Date.now())
watch(status, (s) => {
  if (s === 'setup') now.value = Date.now()
})

/** 已選資料集涉及的分類，以及各分類可選的測驗方向 */
const modeGroups = computed(() => {
  const categories = new Set<Category>(selectedDatasets.value.map((d) => d.category))
  return [...categories].map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    modes: QUIZ_MODES.filter((m) => m.category === category),
  }))
})

const newToday = computed(() => progress.statsFor(now.value).newCards)
const newRemaining = computed(() => Math.max(0, newCardsPerDay.value - newToday.value))

const dueCount = computed(() =>
  selectedDatasets.value.reduce(
    (sum, d) => sum + countDataset(d, enabledModes.value, progress.get, now.value).due,
    0,
  ),
)

function buildQueue() {
  return buildStudyQueue({
    datasets: selectedDatasets.value,
    modeIds: enabledModes.value,
    progress: progress.get,
    newLimit: newRemaining.value,
    now: now.value,
  })
}

// 只用來顯示張數；實際開始時會重新洗牌
const queuePreviewSize = computed(() => buildQueue().length)
const newInQueue = computed(() => queuePreviewSize.value - dueCount.value)

const practiceDeckSize = computed(() =>
  selectedDatasets.value
    .filter((d) => enabledModes.value.some((id) => getQuizMode(id).category === d.category))
    .reduce((sum, d) => sum + d.data.length, 0),
)

const progressPercent = computed(() =>
  queue.value.length ? Math.round((index.value / queue.value.length) * 100) : 0,
)

function startStudy() {
  now.value = Date.now()
  session.start(buildQueue(), 'srs')
}

function startPractice() {
  session.start(buildPracticeDeck(selectedDatasets.value, enabledModes.value), 'practice')
}

function onNewLimitInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isInteger(value) && value >= 0 && value <= 999) newCardsPerDay.value = value
}

const SRS_KEYS: Record<string, Grade> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }
const PRACTICE_KEYS: Record<string, Grade> = {
  '1': 'again',
  ArrowLeft: 'again',
  '2': 'good',
  ArrowRight: 'good',
}

function onKeydown(event: KeyboardEvent) {
  if (status.value !== 'active' || event.ctrlKey || event.metaKey || event.altKey) return
  // 事件可能直接發在 window 上（不是 Element）
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('input, textarea, select')) return

  if (event.key === ' ' || event.key === 'Enter') {
    // 焦點在按鈕上時讓按鈕自己處理，避免觸發兩次
    if (target?.closest('button')) return
    event.preventDefault()
    session.flip()
    return
  }

  const grade = (mode.value === 'srs' ? SRS_KEYS : PRACTICE_KEYS)[event.key]
  if (flipped.value && grade) session.answer(grade)
}

onMounted(() => {
  datasetsStore.ensureLoaded()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="study">
    <div v-if="progress.readOnly" class="warning" role="alert">
      無法讀取瀏覽器中已存的學習進度（格式不符）。為避免覆蓋，這次的進度不會被儲存。
    </div>
    <div v-else-if="progress.saveFailed" class="warning" role="alert">
      學習進度儲存失敗，可能是瀏覽器儲存空間已滿或被封鎖。
    </div>

    <!-- 設定 -->
    <template v-if="status === 'setup'">
      <h1>學習</h1>

      <p v-if="loadStatus !== 'ready'" class="muted">載入中…</p>

      <div v-else-if="selectedDatasets.length === 0" class="panel">
        <p>還沒有選擇資料集。</p>
        <RouterLink to="/" class="btn btn-primary">去選擇資料集</RouterLink>
      </div>

      <template v-else>
        <div class="panel">
          <h2>資料集</h2>
          <p>
            {{ selectedDatasets.map((d) => d.name).join('、') }}
            <span class="muted">（共 {{ selectedItemCount }} 筆）</span>
          </p>
          <RouterLink to="/" class="small-link">變更</RouterLink>
        </div>

        <div class="panel">
          <h2>測驗方向</h2>
          <p class="muted small">可複選；每個方向的記憶進度分開計算。</p>
          <fieldset v-for="group in modeGroups" :key="group.category" class="mode-group">
            <legend>{{ group.label }}</legend>
            <label v-for="m in group.modes" :key="m.id" class="mode-option">
              <input
                type="checkbox"
                :checked="enabledModes.includes(m.id)"
                @change="session.toggleMode(m.id)"
              />
              {{ m.label }}
            </label>
          </fieldset>
        </div>

        <div class="panel">
          <h2>今天</h2>
          <div class="today">
            <div>
              <div class="stat-num due">{{ dueCount }}</div>
              <div class="muted small">到期複習</div>
            </div>
            <div>
              <div class="stat-num new">{{ newInQueue }}</div>
              <div class="muted small">新卡</div>
            </div>
          </div>
          <label class="new-limit">
            每日新卡上限
            <input
              type="number"
              min="0"
              max="999"
              :value="newCardsPerDay"
              @change="onNewLimitInput"
            />
            <span class="muted small">（今天已學 {{ newToday }} 張）</span>
          </label>
        </div>

        <p v-if="queuePreviewSize === 0" class="done-message">
          今天的卡片都完成了！可以明天再來，或用自由練習多複習幾次。
        </p>

        <div class="start-row">
          <button
            type="button"
            class="btn"
            :disabled="practiceDeckSize === 0"
            title="洗牌練習全部卡片，不影響記憶進度"
            @click="startPractice"
          >
            自由練習（{{ practiceDeckSize }}）
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="queuePreviewSize === 0"
            @click="startStudy"
          >
            開始學習（{{ queuePreviewSize }}）
          </button>
        </div>
      </template>
    </template>

    <!-- 學習中 -->
    <template v-else-if="status === 'active' && current">
      <div class="session-header">
        <span class="muted small">
          {{ mode === 'srs' ? '記憶複習' : '自由練習' }}・{{ current.datasetName }}・{{
            getQuizMode(current.modeId).label
          }}
        </span>
        <span class="counter">剩 {{ remaining }} 張</span>
      </div>
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="index"
        aria-valuemin="0"
        :aria-valuemax="queue.length"
      >
        <div class="progress-bar" :style="{ width: `${progressPercent}%` }" />
      </div>

      <FlashCard
        :key="`${current.key}#${index}`"
        :card="current"
        :flipped="flipped"
        @flip="session.flip()"
      />

      <div class="answer-row">
        <button v-if="!flipped" type="button" class="btn btn-primary wide" @click="session.flip()">
          翻面 <kbd>Space</kbd>
        </button>
        <GradeButtons
          v-else
          class="wide"
          :intervals="intervalPreview"
          @grade="session.answer"
        />
      </div>

      <div class="end-row">
        <button type="button" class="small-link" @click="session.reset()">結束</button>
      </div>
    </template>

    <!-- 結果 -->
    <template v-else-if="status === 'finished'">
      <h1>{{ mode === 'srs' ? '今天的學習完成了' : '練習完成' }}</h1>
      <div class="panel summary">
        <div>
          <div class="stat-num">{{ studiedCount }}</div>
          <div class="muted small">張卡</div>
        </div>
        <div>
          <div class="stat-num good">{{ knownCount }}</div>
          <div class="muted small">第一次就記得</div>
        </div>
        <div>
          <div class="stat-num again">{{ unknownCards.length }}</div>
          <div class="muted small">忘記</div>
        </div>
      </div>
      <p v-if="mode === 'srs'" class="muted small center">
        共評分 {{ reviewCount }} 次，進度已儲存在這個瀏覽器中。
      </p>
      <div class="start-row">
        <button type="button" class="btn" @click="session.reset()">回到設定</button>
        <button
          v-if="unknownCards.length"
          type="button"
          class="btn btn-primary"
          @click="session.retryUnknown()"
        >
          再練一次忘記的（{{ unknownCards.length }}）
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.study {
  max-width: 640px;
  margin: 0 auto;
}

h1 {
  margin-top: 0;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.muted {
  color: var(--color-text-muted);
}

.small {
  font-size: 0.875rem;
}

.center {
  text-align: center;
}

.warning {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-danger);
  border-radius: var(--radius);
  background: var(--color-danger-soft);
  font-size: 0.875rem;
}

.panel {
  margin-bottom: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.panel p {
  margin: 0 0 0.5rem;
}

.small-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.875rem;
  text-decoration: none;
  cursor: pointer;
}

.mode-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.25rem;
  margin: 0.5rem 0 0;
  padding: 0.5rem 0.75rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.mode-group legend {
  padding: 0 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.mode-option {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  cursor: pointer;
}

.mode-option input {
  accent-color: var(--color-primary);
}

.today {
  display: flex;
  gap: 2.5rem;
  margin-bottom: 0.75rem;
}

.new-limit {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.new-limit input {
  width: 4.5rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}

.done-message {
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  text-align: center;
}

.start-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.session-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.375rem;
}

.counter {
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.progress {
  height: 6px;
  margin-bottom: 1rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-hover);
}

.progress-bar {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.2s ease;
}

.answer-row {
  display: flex;
  gap: 0.75rem;
  margin-top: 1rem;
}

.wide {
  flex: 1;
}

.end-row {
  margin-top: 1rem;
  text-align: center;
}

.summary {
  display: flex;
  justify-content: space-around;
  text-align: center;
}

.stat-num {
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stat-num.due {
  color: var(--color-primary);
}

.stat-num.new {
  color: var(--color-vocab);
}

.stat-num.good {
  color: var(--color-success);
}

.stat-num.again {
  color: var(--color-danger);
}
</style>
