<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkedSentence } from '@/lib/grammarMarkup'

const props = defineProps<{
  sentence: string
  /** 把【】標記的部分顯示成空格（挖空題） */
  cloze?: boolean
}>()

const segments = computed(() => parseMarkedSentence(props.sentence))
</script>

<template>
  <span lang="ja">
    <template v-for="(segment, i) in segments" :key="i">
      <span v-if="segment.marked && cloze" class="cloze-blank"
        ><span class="visually-hidden">（空格）</span></span
      >
      <mark v-else-if="segment.marked" class="grammar-mark">{{ segment.text }}</mark>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>
