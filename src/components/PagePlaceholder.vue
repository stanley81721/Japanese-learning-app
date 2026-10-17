<script setup lang="ts">
defineProps<{
  title: string
  milestone: string
  description: string
}>()
</script>

<template>
  <section class="placeholder">
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <p class="milestone">預計於 {{ milestone }} 實作</p>
  </section>
</template>

<style scoped>
.placeholder {
  padding: 1.5rem;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.placeholder h1 {
  margin-top: 0;
}

.milestone {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>
