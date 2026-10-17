import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { useSettingsStore } from '@/stores/settings'

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  )
}

/** 優先選本機的 ja-JP 語音（離線也能用），其次任何日文語音 */
export function pickJapaneseVoice(
  voices: readonly SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  const japanese = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'))
  return (
    japanese.find((v) => v.localService && v.lang.toLowerCase().replace('_', '-') === 'ja-jp') ??
    japanese.find((v) => v.localService) ??
    japanese[0]
  )
}

/** 日文發音（Web Speech API）。裝置沒有日文語音時 available 為 false，介面會隱藏發音按鈕。 */
export const useSpeechStore = defineStore('speech', () => {
  const settings = useSettingsStore()
  const supported = isSpeechSupported()
  const voices = shallowRef<SpeechSynthesisVoice[]>([])

  function loadVoices() {
    voices.value = window.speechSynthesis.getVoices()
  }

  if (supported) {
    loadVoices()
    // 多數瀏覽器的語音清單是非同步載入的
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
  }

  const voice = computed(() => pickJapaneseVoice(voices.value))
  const available = computed(() => supported && Boolean(voice.value))

  function speak(text: string) {
    if (!available.value || !text.trim()) return
    const synth = window.speechSynthesis
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'
    utterance.voice = voice.value!
    utterance.rate = settings.ttsRate
    synth.speak(utterance)
  }

  function cancel() {
    if (supported) window.speechSynthesis.cancel()
  }

  return { supported, voice, available, speak, cancel }
})
