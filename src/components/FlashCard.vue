<script setup lang="ts">
import MarkdownContent from '@/components/MarkdownContent.vue'
import type { CardText, StudyCard } from '@/lib/quizModes'

defineProps<{
  card: StudyCard
  flipped: boolean
}>()

const emit = defineEmits<{ flip: [] }>()

const langOf = (t: CardText) => (t.lang === 'ja' ? 'ja' : 'zh-Hant')

// 點擊卡片翻面；解釋中的連結照常開啟。鍵盤操作由 StudyView 的按鈕與快捷鍵負責。
function onClick(event: MouseEvent) {
  if ((event.target as HTMLElement).closest('a')) return
  emit('flip')
}
</script>

<template>
  <div class="flashcard" :class="{ flipped }" @click="onClick">
    <div class="card-inner">
      <div class="face front" :aria-hidden="flipped" :inert="flipped || undefined">
        <div class="main" :class="card.front.lang" :lang="langOf(card.front)">
          {{ card.front.text }}
        </div>
        <div class="hint">點擊卡片或按空白鍵翻面</div>
      </div>

      <div class="face back" :aria-hidden="!flipped" :inert="!flipped || undefined">
        <div class="question" :lang="langOf(card.front)">{{ card.front.text }}</div>
        <div class="main" :class="card.back.lang" :lang="langOf(card.back)">
          {{ card.back.text }}
        </div>
        <div v-if="card.back.sub" class="sub" :lang="langOf(card.back.sub)">
          {{ card.back.sub.text }}
        </div>
        <MarkdownContent
          v-if="card.back.explanation"
          class="explanation"
          :source="card.back.explanation"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.flashcard {
  height: clamp(280px, 52vh, 440px);
  text-align: center;
  cursor: pointer;
  perspective: 1200px;
  user-select: none;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.45s ease;
  transform-style: preserve-3d;
}

.flipped .card-inner {
  transform: rotateY(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .card-inner {
    transition: none;
  }
}

.face {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: calc(var(--radius) * 2);
  background: var(--color-surface);
  box-shadow: 0 4px 16px rgb(15 23 42 / 0.08);
  backface-visibility: hidden;
}

.back {
  justify-content: flex-start;
  transform: rotateY(180deg);
  user-select: text;
}

.main {
  font-size: clamp(1.75rem, 7vw, 3rem);
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.back .main {
  margin-top: auto;
}

.main.zh {
  font-size: clamp(1.5rem, 6vw, 2.5rem);
}

.sub {
  color: var(--color-text-muted);
  font-size: 1.25rem;
}

.question {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.hint {
  position: absolute;
  bottom: 1rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.explanation {
  width: 100%;
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--color-border);
  text-align: left;
}

/* 沒有解釋時讓答案垂直置中 */
.back .main:last-child,
.back .sub:last-child {
  margin-bottom: auto;
}
</style>
