<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'

import AnswerMethodPicker from '@/components/AnswerMethodPicker.vue'
import ModePicker from '@/components/ModePicker.vue'
import SessionPanel from '@/components/SessionPanel.vue'
import { buildPracticeDeck } from '@/lib/deck'
import { buildStudyQueue, countDataset } from '@/lib/queue'
import { getQuizMode } from '@/lib/quizModes'
import { useDatasetsStore } from '@/stores/datasets'
import { useProgressStore } from '@/stores/progress'
import { useSettingsStore } from '@/stores/settings'
import { useStudySessionStore } from '@/stores/studySession'

const datasetsStore = useDatasetsStore()
const progress = useProgressStore()
const settings = useSettingsStore()
const session = useStudySessionStore()
const { status: loadStatus, selectedDatasets, selectedItemCount } = storeToRefs(datasetsStore)
const { newCardsPerDay, answerMethods } = storeToRefs(settings)
const { mode, status, enabledModes, studiedCount, reviewCount, knownCount, unknownCards } =
  storeToRefs(session)

// 回到設定畫面時更新時間，讓到期數保持正確
const now = ref(Date.now())
watch(status, (s) => {
  if (s === 'setup') now.value = Date.now()
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

function startStudy() {
  now.value = Date.now()
  session.start(buildQueue(), {
    mode: 'srs',
    methods: answerMethods.value,
    pool: selectedDatasets.value,
  })
}

function startPractice() {
  session.start(buildPracticeDeck(selectedDatasets.value, enabledModes.value), {
    mode: 'practice',
    methods: answerMethods.value,
    pool: selectedDatasets.value,
  })
}

function onNewLimitChange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  if (Number.isInteger(value) && value >= 0 && value <= 999) newCardsPerDay.value = value
}

onMounted(() => datasetsStore.ensureLoaded())
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
          <h2>測驗方式</h2>
          <p class="muted small">
            可複選；每題會從勾選的方向與作答方式中隨機挑選。每個方向的記憶進度分開計算。
          </p>
          <ModePicker
            :datasets="selectedDatasets"
            :enabled="enabledModes"
            @toggle="session.toggleMode"
          />
          <AnswerMethodPicker />
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
              @change="onNewLimitChange"
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
    <SessionPanel
      v-else-if="status === 'active'"
      :session="session"
      :label="mode === 'srs' ? '記憶複習' : '自由練習'"
    />

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
          <div class="muted small">第一次就答對</div>
        </div>
        <div>
          <div class="stat-num again">{{ unknownCards.length }}</div>
          <div class="muted small">答錯</div>
        </div>
      </div>
      <p v-if="mode === 'srs'" class="muted small center">
        共作答 {{ reviewCount }} 次，進度已儲存在這個瀏覽器中。
      </p>
      <div class="start-row">
        <button type="button" class="btn" @click="session.reset()">回到設定</button>
        <button
          v-if="unknownCards.length"
          type="button"
          class="btn btn-primary"
          @click="session.retryUnknown()"
        >
          再練一次答錯的（{{ unknownCards.length }}）
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

.small-link {
  color: var(--color-primary);
  font-size: 0.875rem;
  text-decoration: none;
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
