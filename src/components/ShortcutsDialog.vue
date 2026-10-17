<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const open = defineModel<boolean>({ required: true })
const closeEl = ref<HTMLButtonElement>()
let returnFocus: HTMLElement | null = null

const groups = [
  {
    title: '翻卡',
    keys: [
      ['Space / Enter', '翻面'],
      ['1 – 4', '再一次／困難／良好／簡單（記憶複習）'],
      ['1 / ←、2 / →', '不會／會了（自由練習、測驗）'],
    ],
  },
  {
    title: '選擇題與輸入題',
    keys: [
      ['1 – 4', '選擇選項'],
      ['Enter', '送出答案；作答後繼續下一題'],
    ],
  },
  {
    title: '其他',
    keys: [
      ['P', '朗讀日文'],
      ['?', '開啟或關閉這個說明'],
      ['Esc', '關閉這個說明'],
    ],
  },
]

watch(open, async (isOpen) => {
  if (isOpen) {
    returnFocus = document.activeElement as HTMLElement | null
    await nextTick()
    closeEl.value?.focus()
  } else {
    returnFocus?.focus?.()
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) {
    event.stopImmediatePropagation()
    open.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="open = false">
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
      <div class="dialog-header">
        <h2 id="shortcuts-title">鍵盤快捷鍵</h2>
        <button ref="closeEl" type="button" class="btn close" @click="open = false">關閉</button>
      </div>
      <section v-for="group in groups" :key="group.title">
        <h3>{{ group.title }}</h3>
        <dl>
          <template v-for="[key, action] in group.keys" :key="key + action">
            <dt>
              <kbd>{{ key }}</kbd>
            </dt>
            <dd>{{ action }}</dd>
          </template>
        </dl>
      </section>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(0 0 0 / 0.4);
}

.dialog {
  width: min(480px, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: 1.25rem 1.5rem;
  border-radius: calc(var(--radius) * 1.5);
  background: var(--color-surface);
  box-shadow: 0 16px 48px rgb(0 0 0 / 0.25);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 0;
  font-size: 1.125rem;
}

h3 {
  margin: 1rem 0 0.375rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.375rem 1rem;
  margin: 0;
  font-size: 0.9375rem;
}

dt {
  white-space: nowrap;
}

dd {
  margin: 0;
}

.close {
  padding: 0.25rem 0.75rem;
}
</style>
