<script setup lang="ts">
import MarkedSentence from '@/components/MarkedSentence.vue'
import type { CardText } from '@/lib/quizModes'

defineProps<{ value: CardText }>()
</script>

<template>
  <div :lang="value.lang === 'ja' ? 'ja' : 'zh-Hant'" :class="{ sentence: value.sentence }">
    <MarkedSentence v-if="value.sentence" :sentence="value.sentence" :cloze="value.cloze" />
    <template v-else>{{ value.text }}</template>
  </div>
</template>
