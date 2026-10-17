<script setup lang="ts">
import { storeToRefs } from 'pinia'

import { ANSWER_METHODS } from '@/lib/answerMethods'
import { useSettingsStore } from '@/stores/settings'

const settings = useSettingsStore()
const { answerMethods } = storeToRefs(settings)
</script>

<template>
  <fieldset class="option-group">
    <legend>作答方式</legend>
    <label v-for="m in ANSWER_METHODS" :key="m.id" class="option method-option">
      <input
        type="checkbox"
        :checked="answerMethods.includes(m.id)"
        :disabled="answerMethods.length === 1 && answerMethods.includes(m.id)"
        @change="settings.toggleAnswerMethod(m.id)"
      />
      {{ m.label }}
    </label>
  </fieldset>
</template>
