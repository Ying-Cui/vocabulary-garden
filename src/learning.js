import { isDue, wordStatus } from './progress.js'

export function shuffle(items, random = Math.random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
export function dailyBatch(words, progress, limit = 20, now = Date.now(), random = Math.random) {
  const due = words.filter(word => isDue(progress[word.id], now))
    .sort((a, b) => (progress[a.id]?.nextReviewAt || 0) - (progress[b.id]?.nextReviewAt || 0))
  const fresh = shuffle(words.filter(word => wordStatus(progress[word.id], now) === 'unseen'), random)
  return [...due, ...fresh].slice(0, limit)
}
export function mixedBatch(words, sources, limit = 20, random = Math.random) {
  if (new Set(sources).size < 2) return []
  const groups = shuffle([...new Set(sources)], random).map(source => shuffle(words.filter(word => word.source === source), random)).filter(group => group.length)
  if (groups.length < 2) return []
  const first = groups.map(group => group.shift())
  return shuffle([...first.slice(0, limit), ...shuffle(groups.flat(), random).slice(0, Math.max(0, limit - first.length))], random)
}
export function hintFor(word) {
  return word.english.replace(/[~～?.!]/g, '').trim().split(/\s+/).map(part => part[0] + '＿'.repeat(Math.max(0, part.length - 1))).join(' ')
}

// Revisit once, after at least three DIFFERENT words. Add fillers inside the chosen
// range if a mistake occurs near the end. A one-word range is left for tomorrow.
export function enqueueReview(queue, index, pool, random = Math.random) {
  const current = queue[index]
  if (!current || current.replay || current.filler) return queue
  const result = [...queue]
  const others = new Set()
  let insertion = index + 1
  while (insertion < result.length && others.size < 3) {
    const id = result[insertion].word.id
    if (id !== current.word.id) others.add(id)
    insertion++
  }
  if (others.size < 3) {
    const fillers = shuffle(pool.filter(word => word.id !== current.word.id && !others.has(word.id)), random)
      .slice(0, 3 - others.size)
    if (others.size + fillers.length < 3) return queue
    const items = fillers.map(word => ({ word, mode: current.mode, filler: true, replay: false }))
    result.splice(insertion, 0, ...items)
    insertion += items.length
  }
  result.splice(insertion, 0, { word: current.word, mode: current.mode, replay: true, filler: false })
  return result
}
