<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/lib/markdown'

const props = defineProps<{ source: string }>()

// renderMarkdown 會轉義原始 HTML，所以可以安全使用 v-html
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <!-- 解釋以中文為主、夾雜日文 -->
  <div class="markdown" lang="zh-Hant" v-html="html" />
</template>
