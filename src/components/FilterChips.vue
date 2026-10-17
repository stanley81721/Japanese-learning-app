<script setup lang="ts" generic="T extends string">
defineProps<{
  label: string
  options: { value: T; label: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="filter" role="radiogroup" :aria-label="label">
    <span class="filter-label">{{ label }}</span>
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      class="chip"
      :aria-checked="model === option.value"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.filter-label {
  min-width: 3rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.chip {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.chip:hover {
  background: var(--color-hover);
}

.chip[aria-checked='true'] {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 600;
}
</style>
