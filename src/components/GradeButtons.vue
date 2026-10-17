<script setup lang="ts">
import type { Grade } from '@/lib/srs'

defineProps<{
  /** 各評分的下次間隔；null 時為自由練習的「不會／會了」兩鍵 */
  intervals: Record<Grade, string> | null
}>()

defineEmits<{ grade: [grade: Grade] }>()

const srsButtons: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: '再一次', key: '1' },
  { grade: 'hard', label: '困難', key: '2' },
  { grade: 'good', label: '良好', key: '3' },
  { grade: 'easy', label: '簡單', key: '4' },
]

const practiceButtons: { grade: Grade; label: string; key: string }[] = [
  { grade: 'again', label: '不會', key: '1' },
  { grade: 'good', label: '會了', key: '2' },
]
</script>

<template>
  <div class="grades" :class="{ srs: intervals }">
    <button
      v-for="button in intervals ? srsButtons : practiceButtons"
      :key="button.grade"
      type="button"
      class="btn grade"
      :class="button.grade"
      @click="$emit('grade', button.grade)"
    >
      <span
        >{{ button.label }} <kbd>{{ button.key }}</kbd></span
      >
      <span v-if="intervals" class="interval">{{ intervals[button.grade] }}</span>
    </button>
  </div>
</template>

<style scoped>
.grades {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.grades.srs {
  grid-template-columns: repeat(4, 1fr);
}

@media (max-width: 480px) {
  .grades.srs {
    grid-template-columns: repeat(2, 1fr);
  }
}

.grade {
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.5rem;
}

.interval {
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: normal;
}

.again {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.hard {
  border-color: var(--color-grammar);
  color: var(--color-grammar);
}

.good {
  border-color: var(--color-success);
  color: var(--color-success);
}

.easy {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
