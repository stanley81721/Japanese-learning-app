<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'

import FlashCard from '@/components/FlashCard.vue'
import GradeButtons from '@/components/GradeButtons.vue'
import SpeakButton from '@/components/SpeakButton.vue'
import { getQuizMode } from '@/lib/quizModes'
import type { Grade } from '@/lib/srs'
import { useSettingsStore } from '@/stores/settings'
import { useSpeechStore } from '@/stores/speech'
import type { SessionStore } from '@/stores/studySession'

const props = defineProps<{
  session: SessionStore
  /** 標題列顯示的模式名稱，例如「記憶複習」「測驗」 */
  label: string
}>()

const { mode, currentEntry, flipped, response, index, queue, remaining, intervalPreview } =
  storeToRefs(props.session)

const typed = ref('')
const inputEl = ref<HTMLInputElement>()
const continueEl = ref<HTMLButtonElement>()

// 只在 currentEntry 存在時（模板的 v-if 內）使用
const card = computed(() => currentEntry.value!.card)
const method = computed(() => currentEntry.value?.method)
const progressPercent = computed(() =>
  queue.value.length ? Math.round((index.value / queue.value.length) * 100) : 0,
)

const hint = computed(() =>
  method.value === 'flip'
    ? '點擊卡片或按空白鍵翻面'
    : method.value === 'choice'
      ? '選出正確答案'
      : '輸入日文答案',
)

// 換題時清空輸入並把焦點放到輸入框；作答後把焦點放到「繼續」
watch(
  () => `${index.value}`,
  async () => {
    typed.value = ''
    await nextTick()
    if (method.value === 'input') inputEl.value?.focus()
  },
  { immediate: true },
)
watch(response, async (r) => {
  if (!r) return
  await nextTick()
  continueEl.value?.focus()
})

// 發音：題目是日文時正面就能聽；否則翻面（或作答）後才能，以免洩漏答案
const settings = useSettingsStore()
const speech = useSpeechStore()
const canSpeak = computed(
  () => Boolean(currentEntry.value) && (card.value.speakOnFront || flipped.value),
)

function speakCard() {
  if (canSpeak.value) speech.speak(card.value.speech)
}

watch(flipped, (isFlipped) => {
  if (isFlipped && settings.ttsAutoplay) speakCard()
})
watch(index, () => speech.cancel())
onBeforeUnmount(() => speech.cancel())

function onCardClick() {
  if (method.value === 'flip') props.session.flip()
}

function choiceClass(i: number, text: string) {
  const r = response.value
  if (!r) return {}
  return {
    correct: text === card.value.back.text,
    wrong: r.choice === i && text !== card.value.back.text,
  }
}

const SRS_KEYS: Record<string, Grade> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' }
const PRACTICE_KEYS: Record<string, Grade> = {
  '1': 'again',
  ArrowLeft: 'again',
  '2': 'good',
  ArrowRight: 'good',
}

function onKeydown(event: KeyboardEvent) {
  if (!currentEntry.value || event.ctrlKey || event.metaKey || event.altKey) return
  // 事件可能直接發在 window 上（不是 Element）
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('input, textarea, select')) return
  // 有對話框（例如快捷鍵說明）開著時不要操作後面的卡片
  if (document.querySelector('[aria-modal="true"]')) return
  const onButton = Boolean(target?.closest('button'))
  const isConfirmKey = event.key === ' ' || event.key === 'Enter'

  if (event.key === 'p' || event.key === 'P') {
    speakCard()
    return
  }

  if (response.value) {
    // 焦點在按鈕上時讓按鈕自己處理，避免觸發兩次
    if (isConfirmKey && !onButton) {
      event.preventDefault()
      props.session.proceed()
    }
    return
  }

  if (method.value === 'choice') {
    const n = Number(event.key)
    if (n >= 1 && n <= (currentEntry.value.choices?.length ?? 0)) props.session.submitChoice(n - 1)
    return
  }

  if (method.value === 'flip') {
    if (isConfirmKey) {
      if (onButton) return
      event.preventDefault()
      props.session.flip()
      return
    }
    const grade = (intervalPreview.value ? SRS_KEYS : PRACTICE_KEYS)[event.key]
    if (flipped.value && grade) props.session.answer(grade)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="session" v-if="currentEntry">
    <h1 class="visually-hidden">{{ label }}</h1>
    <div class="session-header">
      <span class="muted small">
        {{ label }}・{{ card.datasetName }}・{{ getQuizMode(card.modeId).label }}
      </span>
      <span class="counter">剩 {{ remaining }} 張</span>
    </div>
    <div
      class="progress"
      role="progressbar"
      aria-label="本次進度"
      :aria-valuenow="index"
      aria-valuemin="0"
      :aria-valuemax="queue.length"
    >
      <div class="progress-bar" :style="{ width: `${progressPercent}%` }" />
    </div>

    <div class="card-tools">
      <SpeakButton v-if="canSpeak" :text="card.speech" shortcut="P" />
    </div>

    <FlashCard
      :key="`${card.key}#${index}`"
      :card="card"
      :flipped="flipped"
      :hint="hint"
      :clickable="method === 'flip'"
      @flip="onCardClick"
    />

    <!-- 選擇題 -->
    <ol v-if="method === 'choice'" class="choices">
      <li v-for="(text, i) in currentEntry.choices" :key="text">
        <button
          type="button"
          class="btn choice"
          :class="choiceClass(i, text)"
          :lang="card.back.lang === 'ja' ? 'ja' : 'zh-Hant'"
          :disabled="Boolean(response)"
          @click="session.submitChoice(i)"
        >
          <kbd>{{ i + 1 }}</kbd>
          <span>{{ text }}</span>
        </button>
      </li>
    </ol>

    <!-- 輸入作答 -->
    <form
      v-else-if="method === 'input'"
      class="input-row"
      @submit.prevent="session.submitInput(typed)"
    >
      <input
        ref="inputEl"
        v-model="typed"
        class="answer-input"
        lang="ja"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        placeholder="輸入日文（漢字或假名皆可）"
        aria-label="答案"
        :disabled="Boolean(response)"
      />
      <button type="submit" class="btn btn-primary" :disabled="Boolean(response) || !typed.trim()">
        確認
      </button>
    </form>

    <!-- 選擇題、輸入題的結果 -->
    <div
      v-if="response"
      class="feedback"
      :class="response.correct ? 'correct' : 'wrong'"
      role="status"
    >
      <span v-if="response.overridden">已改判為正確</span>
      <span v-else-if="response.correct">答對了！</span>
      <span v-else>
        答錯了，正確答案：<strong :lang="card.back.lang === 'ja' ? 'ja' : 'zh-Hant'">{{
          card.back.text
        }}</strong>
      </span>
      <div class="feedback-actions">
        <button
          v-if="!response.correct && response.input !== undefined"
          type="button"
          class="small-link"
          @click="session.overrideCorrect()"
        >
          我其實答對了
        </button>
        <button ref="continueEl" type="button" class="btn btn-primary" @click="session.proceed()">
          繼續 <kbd>Enter</kbd>
        </button>
      </div>
    </div>

    <!-- 翻卡自評 -->
    <div v-if="method === 'flip'" class="answer-row">
      <button v-if="!flipped" type="button" class="btn btn-primary wide" @click="session.flip()">
        翻面 <kbd>Space</kbd>
      </button>
      <GradeButtons
        v-else
        class="wide"
        :intervals="mode === 'srs' ? intervalPreview : null"
        @grade="session.answer"
      />
    </div>

    <div class="end-row">
      <button type="button" class="small-link" @click="session.reset()">結束</button>
    </div>
  </div>
</template>

<style scoped>
.muted {
  color: var(--color-text-muted);
}

.small {
  font-size: 0.875rem;
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

/* 固定高度，發音按鈕出現或消失時卡片不會跳動 */
.card-tools {
  display: flex;
  justify-content: flex-end;
  min-height: 1.875rem;
  margin: -0.5rem 0 0.25rem;
}

.choices {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 480px) {
  .choices {
    grid-template-columns: 1fr;
  }
}

.choice {
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  font-weight: 500;
  text-align: left;
}

.choice:disabled {
  opacity: 1;
  cursor: default;
}

.choice.correct {
  border-color: var(--color-success);
  box-shadow: 0 0 0 1px var(--color-success);
  color: var(--color-success);
  font-weight: 700;
}

.choice.wrong {
  border-color: var(--color-danger);
  color: var(--color-danger);
  text-decoration: line-through;
}

.input-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.answer-input {
  flex: 1;
  min-width: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 1.125rem;
}

.feedback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid;
  border-radius: var(--radius);
  font-weight: 600;
}

.feedback.correct {
  border-color: var(--color-success);
  color: var(--color-success);
}

.feedback.wrong {
  border-color: var(--color-danger);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.feedback-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
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

.small-link {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}
</style>
