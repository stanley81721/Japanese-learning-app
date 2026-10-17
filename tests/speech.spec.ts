import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import App from '@/App.vue'
import SessionPanel from '@/components/SessionPanel.vue'
import { buildCard } from '@/lib/quizModes'
import { routes } from '@/router'
import { useDatasetsStore } from '@/stores/datasets'
import { sanitizeSettings, useSettingsStore } from '@/stores/settings'
import { pickJapaneseVoice, useSpeechStore } from '@/stores/speech'
import { useStudySessionStore } from '@/stores/studySession'
import type { Dataset } from '@/types/dataset'
import { pwaState } from './setup'

const voice = (name: string, lang: string, localService = true) =>
  ({ name, lang, localService }) as SpeechSynthesisVoice

class FakeUtterance {
  lang = ''
  rate = 1
  voice: SpeechSynthesisVoice | null = null
  constructor(public text: string) {}
}

function installSpeech(voices: SpeechSynthesisVoice[]) {
  const synth = {
    getVoices: () => voices,
    speak: vi.fn(),
    cancel: vi.fn(),
    addEventListener: vi.fn(),
  }
  Object.assign(window, { speechSynthesis: synth, SpeechSynthesisUtterance: FakeUtterance })
  return synth
}

function uninstallSpeech() {
  const w = window as unknown as Record<string, unknown>
  delete w.speechSynthesis
  delete w.SpeechSynthesisUtterance
}

afterEach(uninstallSpeech)

const vocab: Dataset = {
  id: 'vocabulary/t',
  name: 'T',
  category: 'vocabulary',
  level: 'N5',
  data: [
    { id: '1', japanese: '株式', hiragana: 'かぶしき', simple_chinese: '股份' },
    { id: '2', japanese: 'コスト', simple_chinese: '成本' },
  ],
}
const grammar: Dataset = {
  id: 'grammar/t',
  name: 'G',
  category: 'grammar',
  level: 'N3',
  data: [
    {
      id: 'g',
      japanese: 'さえ～ば',
      simple_chinese: '只要～就',
      examples: [{ sentence: 'お金【さえ】あれ【ば】いい。' }],
    },
  ],
}

describe('pickJapaneseVoice', () => {
  it('prefers a local ja-JP voice, then any local Japanese voice, then any Japanese voice', () => {
    const remote = voice('Remote', 'ja-JP', false)
    const local = voice('Local', 'ja-JP')
    expect(pickJapaneseVoice([voice('En', 'en-US'), remote, local])).toBe(local)
    expect(pickJapaneseVoice([remote])).toBe(remote)
    expect(pickJapaneseVoice([voice('Underscore', 'ja_JP')])?.name).toBe('Underscore')
    expect(pickJapaneseVoice([voice('En', 'en-US')])).toBeUndefined()
  })
})

describe('speech store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('is unavailable without speech support or a Japanese voice', () => {
    expect(useSpeechStore().available).toBe(false)
    setActivePinia(createPinia())
    installSpeech([voice('En', 'en-US')])
    expect(useSpeechStore().available).toBe(false)
  })

  it('speaks Japanese with the chosen voice and rate, cancelling what was playing', () => {
    const synth = installSpeech([voice('Kyoko', 'ja-JP')])
    useSettingsStore().ttsRate = 1.2
    const speech = useSpeechStore()
    expect(speech.available).toBe(true)

    speech.speak('かぶしき')
    expect(synth.cancel).toHaveBeenCalled()
    const utterance = synth.speak.mock.calls[0]![0] as FakeUtterance
    expect(utterance).toMatchObject({ text: 'かぶしき', lang: 'ja-JP', rate: 1.2 })
    expect(utterance.voice?.name).toBe('Kyoko')

    speech.speak('   ')
    expect(synth.speak).toHaveBeenCalledTimes(1)
  })
})

describe('card speech text', () => {
  it('reads the reading for words, the base form for grammar, and the sentence for examples', () => {
    expect(buildCard(vocab, vocab.data[0]!, 'vocab-kanji-to-zh').speech).toBe('かぶしき')
    expect(buildCard(vocab, vocab.data[1]!, 'vocab-zh-to-jp').speech).toBe('コスト')
    expect(buildCard(grammar, grammar.data[0]!, 'grammar-pattern-to-zh').speech).toBe('さえば')
    expect(buildCard(grammar, grammar.data[0]!, 'grammar-cloze').speech).toBe(
      'お金さえあればいい。',
    )
  })

  it('only allows speaking before flipping when it does not reveal the answer', () => {
    expect(buildCard(vocab, vocab.data[0]!, 'vocab-kanji-to-zh').speakOnFront).toBe(true)
    expect(buildCard(vocab, vocab.data[0]!, 'vocab-zh-to-jp').speakOnFront).toBe(false)
    expect(buildCard(grammar, grammar.data[0]!, 'grammar-sentence-to-zh').speakOnFront).toBe(true)
    expect(buildCard(grammar, grammar.data[0]!, 'grammar-cloze').speakOnFront).toBe(false)
  })
})

describe('SessionPanel speech', () => {
  let wrapper: VueWrapper

  afterEach(() => wrapper?.unmount())

  function mountPanel(modeId: 'vocab-kanji-to-zh' | 'vocab-zh-to-jp', autoplay = false) {
    const synth = installSpeech([voice('Kyoko', 'ja-JP')])
    const pinia = createPinia()
    setActivePinia(pinia)
    useSettingsStore().ttsAutoplay = autoplay
    const session = useStudySessionStore()
    session.start([buildCard(vocab, vocab.data[0]!, modeId)], { mode: 'practice' })
    wrapper = mount(SessionPanel, {
      props: { session, label: '測試' },
      global: { plugins: [pinia] },
      attachTo: document.body,
    })
    return { synth, session }
  }

  const press = async (key: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key }))
    await flushPromises()
  }

  it('shows the speak button on the front when the question is Japanese', async () => {
    const { synth } = mountPanel('vocab-kanji-to-zh')
    await wrapper.find('.speak-button').trigger('click')
    expect((synth.speak.mock.calls[0]![0] as FakeUtterance).text).toBe('かぶしき')
    await press('p')
    expect(synth.speak).toHaveBeenCalledTimes(2)
  })

  it('hides it until the card is flipped when the answer is Japanese', async () => {
    const { synth } = mountPanel('vocab-zh-to-jp')
    expect(wrapper.find('.speak-button').exists()).toBe(false)
    await press('p')
    expect(synth.speak).not.toHaveBeenCalled()

    await press(' ')
    expect(wrapper.find('.speak-button').exists()).toBe(true)
  })

  it('reads automatically after flipping when autoplay is on', async () => {
    const { synth } = mountPanel('vocab-zh-to-jp', true)
    expect(synth.speak).not.toHaveBeenCalled()
    await press(' ')
    expect((synth.speak.mock.calls[0]![0] as FakeUtterance).text).toBe('かぶしき')
  })
})

describe('settings', () => {
  it('sanitizes speech settings', () => {
    expect(sanitizeSettings({ ttsAutoplay: true, ttsRate: 1.3 })).toMatchObject({
      ttsAutoplay: true,
      ttsRate: 1.3,
    })
    expect(sanitizeSettings({ ttsAutoplay: 'yes', ttsRate: 9 })).toMatchObject({
      ttsAutoplay: false,
      ttsRate: 0.9,
    })
  })
})

describe('App shell', () => {
  let wrapper: VueWrapper

  afterEach(() => wrapper?.unmount())

  async function mountAt(path: string) {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.push(path)
    await router.isReady()
    const pinia = createPinia()
    wrapper = mount(App, { global: { plugins: [pinia, router] }, attachTo: document.body })
    await useDatasetsStore(pinia).ensureLoaded()
    await flushPromises()
  }

  it('explains when no Japanese voice is available', async () => {
    await mountAt('/settings')
    expect(wrapper.text()).toContain('沒有可用的日文語音')
  })

  it('shows speech settings when a Japanese voice exists', async () => {
    installSpeech([voice('Kyoko', 'ja-JP')])
    await mountAt('/settings')
    expect(wrapper.text()).toContain('使用語音：Kyoko')
    expect(wrapper.find('input[type="range"]').exists()).toBe(true)
  })

  it('offers to reload when a new version is ready', async () => {
    await mountAt('/')
    expect(wrapper.find('.toast').exists()).toBe(false)

    pwaState.needRefresh.value = true
    await flushPromises()
    expect(wrapper.find('.toast').text()).toContain('有新版本')
    await wrapper.find('.toast .btn-primary').trigger('click')
    expect(pwaState.updateServiceWorker).toHaveBeenCalled()
  })

  it('tells the user when the app is ready offline', async () => {
    await mountAt('/')
    pwaState.offlineReady.value = true
    await flushPromises()
    expect(wrapper.find('.toast').text()).toContain('沒有網路也能使用')
    await wrapper.find('.toast .btn').trigger('click')
    expect(wrapper.find('.toast').exists()).toBe(false)
  })
})
