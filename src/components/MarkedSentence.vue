<script setup lang="ts">
import { computed } from 'vue'
import { parseMarkedSentence } from '@/lib/grammarMarkup'

const props = defineProps<{ sentence: string }>()

const segments = computed(() => parseMarkedSentence(props.sentence))
</script>

<template>
  <span lang="ja">
    <template v-for="(segment, i) in segments" :key="i">
      <mark v-if="segment.marked" class="grammar-mark">{{ segment.text }}</mark>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>
