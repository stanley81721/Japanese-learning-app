export type RandomFn = () => number

/** Fisher–Yates 洗牌，回傳新陣列；random 可注入以便測試 */
export function shuffle<T>(items: readonly T[], random: RandomFn = Math.random): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const tmp = result[i]!
    result[i] = result[j]!
    result[j] = tmp
  }
  return result
}

export function pickRandom<T>(items: readonly T[], random: RandomFn = Math.random): T {
  if (items.length === 0) throw new Error('pickRandom: empty array')
  return items[Math.floor(random() * items.length)]!
}
