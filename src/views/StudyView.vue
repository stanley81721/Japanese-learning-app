<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'

import FlashCard from '@/components/FlashCard.vue'
import { buildPracticeDeck } from '@/lib/deck'
import { QUIZ_MODES, getQuizMode } from '@/lib/quizModes'
import { useDatasetsStore } from '@/stores/datasets'
import { useStudySessionStore } from '@/stores/studySession'
import { CATEGORY_LABELS, type Category } from '@/types/dataset'

const datasetsStore = useDatasetsStore()
const session = useStudySessionStore()
const { status: loadStatus, selectedDatasets, selectedItemCount } = storeToRefs(datasetsStore)
const { status, current, flipped, index, cards, enabledModes, knownCount, unknownCards } =
  storeToRefs(session)

/** 已選資料集涉及的分類，以及各分類可選的測驗方向 */
const modeGroups = computed(() => {
  const categories = new Set<Category>(selectedDatasets.value.map((d) => d.category))
  return [...categories].map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    modes: QUIZ_MODES.filter((m) => m.category === category),
  }))
})

const previewDeckSize = computed(() =>
  selectedDatasets.value
    .filter((d) => enabledModes.value.some((id) => getQuizMode(id).category === d.category))
    .reduce((sum, d) => sum + d.data.length, 0),
)

const progressPercent = computed(() =>
  cards.value.length ? Math.round((index.value / cards.value.length) * 100) : 0,
)

function startPractice() {
  session.start(buildPracticeDeck(selectedDatasets.value, enabledModes.value))
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
  } else if (flipped.value && (event.key === '1' || event.key === 'ArrowLeft')) {
    session.answer(false)
  } else if (flipped.value && (event.key === '2' || event.key === 'ArrowRight')) {
    session.answer(true)
  }
}

onMounted(() => {
  datasetsStore.ensureLoaded()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <section class="study">
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
          <p class="muted small">可複選；每張卡會從勾選的方向中隨機挑一個。</p>
          <fieldset v-for="group in modeGroups" :key="group.category" class="mode-group">
            <legend>{{ group.label }}</legend>
            <label v-for="mode in group.modes" :key="mode.id" class="mode-option">
              <input
                type="checkbox"
                :checked="enabledModes.includes(mode.id)"
                @change="session.toggleMode(mode.id)"
              />
              {{ mode.label }}
            </label>
          </fieldset>
        </div>

        <div class="start-row">
          <span class="muted">本次 {{ previewDeckSize }} 張卡</span>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="previewDeckSize === 0"
            @click="startPractice"
          >
            開始練習
          </button>
        </div>
        <p class="muted small">目前為自由練習（洗牌、不記錄進度）。記憶演算法將在 M3 加入。</p>
      </template>
    </template>

    <!-- 練習中 -->
    <template v-else-if="status === 'active' && current">
      <div class="session-header">
        <span class="muted small">
          {{ current.datasetName }}・{{ getQuizMode(current.modeId).label }}
        </span>
        <span class="counter">{{ index + 1 }} / {{ cards.length }}</span>
      </div>
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="index"
        aria-valuemin="0"
        :aria-valuemax="cards.length"
      >
        <div class="progress-bar" :style="{ width: `${progressPercent}%` }" />
      </div>

      <FlashCard :key="current.key" :card="current" :flipped="flipped" @flip="session.flip()" />

      <div class="answer-row">
        <button v-if="!flipped" type="button" class="btn btn-primary wide" @click="session.flip()">
          翻面 <kbd>Space</kbd>
        </button>
        <template v-else>
          <button type="button" class="btn btn-danger wide" @click="session.answer(false)">
            不會 <kbd>1</kbd>
          </button>
          <button type="button" class="btn btn-success wide" @click="session.answer(true)">
            會了 <kbd>2</kbd>
          </button>
        </template>
      </div>

      <div class="end-row">
        <button type="button" class="small-link" @click="session.reset()">結束練習</button>
      </div>
    </template>

    <!-- 結果 -->
    <template v-else-if="status === 'finished'">
      <h1>練習完成</h1>
      <div class="panel summary">
        <div>
          <div class="stat success">{{ knownCount }}</div>
          <div class="muted">會了</div>
        </div>
        <div>
          <div class="stat danger">{{ unknownCards.length }}</div>
          <div class="muted">不會</div>
        </div>
      </div>
      <div class="start-row">
        <button type="button" class="btn" @click="session.reset()">回到設定</button>
        <button
          v-if="unknownCards.length"
          type="button"
          class="btn btn-primary"
          @click="session.retryUnknown()"
        >
          再練一次不會的（{{ unknownCards.length }}）
        </button>
        <button v-else type="button" class="btn btn-primary" @click="startPractice">
          再練一輪
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

.stat {
  font-size: 2.5rem;
  font-weight: 700;
}

.stat.success {
  color: var(--color-success);
}

.stat.danger {
  color: var(--color-danger);
}
</style>
