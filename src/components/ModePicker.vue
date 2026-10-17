<script setup lang="ts">
import { computed } from 'vue'

import { QUIZ_MODES, type QuizModeId } from '@/lib/quizModes'
import { CATEGORY_LABELS, type Category, type Dataset } from '@/types/dataset'

const props = defineProps<{
  datasets: readonly Dataset[]
  enabled: readonly QuizModeId[]
}>()

defineEmits<{ toggle: [modeId: QuizModeId] }>()

/** 只列出已選資料集涉及的分類 */
const groups = computed(() => {
  const categories = new Set<Category>(props.datasets.map((d) => d.category))
  return [...categories].map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    modes: QUIZ_MODES.filter((m) => m.category === category),
  }))
})
</script>

<template>
  <fieldset v-for="group in groups" :key="group.category" class="option-group">
    <legend>{{ group.label }}</legend>
    <label v-for="m in group.modes" :key="m.id" class="option mode-option">
      <input type="checkbox" :checked="enabled.includes(m.id)" @change="$emit('toggle', m.id)" />
      {{ m.label }}
    </label>
  </fieldset>
</template>
