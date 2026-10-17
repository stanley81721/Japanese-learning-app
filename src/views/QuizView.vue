<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'

import AnswerMethodPicker from '@/components/AnswerMethodPicker.vue'
import ModePicker from '@/components/ModePicker.vue'
import SessionPanel from '@/components/SessionPanel.vue'
import { buildPracticeDeck } from '@/lib/deck'
import { getQuizMode } from '@/lib/quizModes'
import { loadJSON, saveJSON } from '@/lib/storage'
import { useDatasetsStore } from '@/stores/datasets'
import { useSettingsStore } from '@/stores/settings'
import { useQuizSessionStore } from '@/stores/studySession'

const datasetsStore = useDatasetsStore()
const settings = useSettingsStore()
const quiz = useQuizSessionStore()
const { status: loadStatus, selectedDatasets, selectedItemCount } = storeToRefs(datasetsStore)
const { answerMethods } = storeToRefs(settings)
const { status, enabledModes, studiedCount, knownCount, unknownCards } = storeToRefs(quiz)

const COUNT_OPTIONS = [10, 20, 50, 0] as const
/** 題數；0 表示全部 */
const questionCount = ref<number>(loadJSON<number>('quiz-count', 20))

const available = computed(() =>
  selectedDatasets.value
    .filter((d) => enabledModes.value.some((id) => getQuizMode(id).category === d.category))
    .reduce((sum, d) => sum + d.data.length, 0),
)
const actualCount = computed(() =>
  questionCount.value === 0 ? available.value : Math.min(questionCount.value, available.value),
)

const scorePercent = computed(() =>
  studiedCount.value ? Math.round((knownCount.value / studiedCount.value) * 100) : 0,
)

function setCount(count: number) {
  questionCount.value = count
  saveJSON('quiz-count', count)
}

function startQuiz() {
  const deck = buildPracticeDeck(selectedDatasets.value, enabledModes.value)
  quiz.start(deck.slice(0, actualCount.value), {
    mode: 'practice',
    methods: answerMethods.value,
    pool: selectedDatasets.value,
  })
}

onMounted(() => datasetsStore.ensureLoaded())
</script>

<template>
  <section class="quiz">
    <!-- 設定 -->
    <template v-if="status === 'setup'">
      <h1>測驗</h1>
      <p class="muted small">測驗結果不會影響記憶進度。</p>

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
          <ModePicker
            :datasets="selectedDatasets"
            :enabled="enabledModes"
            @toggle="quiz.toggleMode"
          />
          <AnswerMethodPicker />
          <fieldset class="option-group">
            <legend>題數</legend>
            <label v-for="count in COUNT_OPTIONS" :key="count" class="option count-option">
              <input
                type="radio"
                name="quiz-count"
                :checked="questionCount === count"
                @change="setCount(count)"
              />
              {{ count === 0 ? '全部' : `${count} 題` }}
            </label>
          </fieldset>
        </div>

        <div class="start-row">
          <button
            type="button"
            class="btn btn-primary"
            :disabled="actualCount === 0"
            @click="startQuiz"
          >
            開始測驗（{{ actualCount }} 題）
          </button>
        </div>
      </template>
    </template>

    <!-- 作答中 -->
    <SessionPanel v-else-if="status === 'active'" :session="quiz" label="測驗" />

    <!-- 成績 -->
    <template v-else-if="status === 'finished'">
      <h1>測驗結果</h1>
      <div class="panel score">
        <div class="score-num">{{ scorePercent }}<span class="unit">分</span></div>
        <div class="muted">答對 {{ knownCount }} / {{ studiedCount }} 題</div>
      </div>

      <div v-if="unknownCards.length" class="panel">
        <h2>答錯的題目（{{ unknownCards.length }}）</h2>
        <ul class="wrong-list">
          <li v-for="card in unknownCards" :key="card.key">
            <span :lang="card.front.lang === 'ja' ? 'ja' : 'zh-Hant'">{{ card.front.text }}</span>
            <span class="arrow" aria-hidden="true">→</span>
            <strong :lang="card.back.lang === 'ja' ? 'ja' : 'zh-Hant'">{{ card.back.text }}</strong>
            <span v-if="card.back.sub" class="muted" lang="ja">（{{ card.back.sub.text }}）</span>
            <span class="muted small mode">{{ getQuizMode(card.modeId).label }}</span>
          </li>
        </ul>
      </div>

      <div class="start-row">
        <button type="button" class="btn" @click="quiz.reset()">回到設定</button>
        <button v-if="unknownCards.length" type="button" class="btn" @click="quiz.retryUnknown()">
          只練答錯的
        </button>
        <button type="button" class="btn btn-primary" @click="startQuiz">再測一次</button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.quiz {
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

.small-link {
  color: var(--color-primary);
  font-size: 0.875rem;
  text-decoration: none;
}

.start-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.score {
  text-align: center;
}

.score-num {
  color: var(--color-primary);
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1.1;
}

.unit {
  margin-left: 0.25rem;
  font-size: 1.25rem;
}

.wrong-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.wrong-list li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
  padding: 0.5rem 0;
}

.wrong-list li + li {
  border-top: 1px solid var(--color-border);
}

.arrow {
  color: var(--color-text-muted);
}

.mode {
  margin-left: auto;
}
</style>
