import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DAY, recordAnswer, wordStatus, summarizeProgress, stageMode, isDue } from './progress.js'
import { dailyBatch, enqueueReview, mixedBatch } from './learning.js'
import { photoSets, scopeWords } from './scopes.js'
const words = JSON.parse(readFileSync(new URL('./vocabulary-v2.json', import.meta.url), 'utf8'))
const noon = new Date(2026, 9, 24, 12).getTime()

test('retention requires three eligible days, with expanding intervals and overdue recall', () => {
  let progress = recordAnswer({}, words[0], true, { mode: 'write', now: noon })
  assert.equal(wordStatus(progress[words[0].id], noon), 'learning')
  assert.equal(progress[words[0].id].nextReviewAt, noon + DAY)
  progress = recordAnswer(progress, words[0], true, { mode: 'write', now: noon + DAY })
  assert.equal(progress[words[0].id].reviewStreak, 2)
  assert.equal(progress[words[0].id].nextReviewAt, noon + 4 * DAY)
  progress = recordAnswer(progress, words[0], true, { mode: 'write', now: noon + 4 * DAY })
  const record = progress[words[0].id]
  assert.equal(record.reviewStreak, 3)
  assert.equal(wordStatus(record, noon + 4 * DAY), 'mastered')
  assert.equal(record.nextReviewAt, noon + 11 * DAY)
  assert.equal(wordStatus(record, noon + 11 * DAY), 'weak')
})

test('same-day, too-early, hinted, choice, card, and delayed replay never earn retention credit', () => {
  let progress = recordAnswer({}, words[0], true, { mode: 'write', now: noon })
  for (const settings of [{}, { hintUsed: true }, { replay: true }, { mode: 'quiz' }, { mode: 'card' }, { mode: 'hint' }]) {
    progress = recordAnswer(progress, words[0], true, { mode: 'write', now: noon + 1000, ...settings })
  }
  assert.equal(progress[words[0].id].reviewStreak, 1)
  assert.equal(progress[words[0].id].nextReviewAt, noon + DAY)
  progress = recordAnswer(progress, words[0], true, { mode: 'write', now: noon + DAY })
  progress = recordAnswer(progress, words[0], true, { mode: 'write', now: noon + 2 * DAY })
  assert.equal(progress[words[0].id].reviewStreak, 2) // next deadline is day 4
  assert.equal(progress[words[0].id].nextReviewAt, noon + 4 * DAY)
  assert.equal(wordStatus(progress[words[0].id], noon + 2 * DAY), 'learning')
})

test('an error resets the interval/streak and replays do not pretend to resolve the next-day test', () => {
  let progress = recordAnswer({}, words[0], true, { mode: 'write', now: noon })
  progress = recordAnswer(progress, words[0], false, { mode: 'write', now: noon + DAY })
  assert.equal(progress[words[0].id].reviewStreak, 0)
  assert.equal(progress[words[0].id].nextReviewAt, noon + 2 * DAY)
  progress = recordAnswer(progress, words[0], true, { mode: 'write', now: noon + DAY + 1000, replay: true })
  assert.equal(wordStatus(progress[words[0].id], noon + DAY + 1000), 'weak')
  assert.equal(progress[words[0].id].wrong, 1)
  progress = recordAnswer(progress, words[0], true, { mode: 'write', now: noon + 2 * DAY })
  assert.equal(wordStatus(progress[words[0].id], noon + 2 * DAY), 'learning')
})

test('stages progress card → choice → hint → unaided input, without mastery inflation', () => {
  let progress = {}
  for (const [mode, nextMode] of [['card','quiz'], ['quiz','hint'], ['hint','write'], ['write','write']]) {
    progress = recordAnswer(progress, words[0], true, { mode, now: noon })
    assert.equal(stageMode(progress[words[0].id]), nextMode)
    assert.equal(wordStatus(progress[words[0].id], noon), 'learning')
  }
  assert.equal(progress[words[0].id].reviewStreak, 0)
})

test('legacy counts remain intact and become due, never fabricated as spaced recall', () => {
  const legacy = { [words[0].id]: { seen: 101, correct: 100, wrong: 1, lastCorrect: true } }
  assert.equal(wordStatus(legacy[words[0].id], noon), 'weak')
  assert.equal(isDue(legacy[words[0].id], noon), true)
  const next = recordAnswer(legacy, words[0], true, { mode: 'write', now: noon })
  assert.equal(next[words[0].id].seen, 102)
  assert.equal(next[words[0].id].correct, 101)
  assert.equal(next[words[0].id].wrong, 1)
  assert.equal(next[words[0].id].reviewStreak, 1)
  assert.equal(legacy[words[0].id].seen, 101)
})

test('all four categories partition the current 200 IDs, ignoring obsolete records', () => {
  let progress = { retired: { seen: 100, correct: 100 } }
  progress = recordAnswer(progress, words[0], true, { now: noon, mode: 'write' })
  progress = recordAnswer(progress, words[0], true, { now: noon + DAY, mode: 'write' })
  progress = recordAnswer(progress, words[0], true, { now: noon + 4 * DAY, mode: 'write' })
  progress = recordAnswer(progress, words[1], false, { now: noon + 4 * DAY })
  progress = recordAnswer(progress, words[2], true, { now: noon + 4 * DAY })
  const summary = summarizeProgress(words, progress, noon + 4 * DAY)
  assert.deepEqual(summary, { mastered: 1, weak: 1, learning: 1, unseen: 197 })
  assert.equal(Object.values(summary).reduce((a,b)=>a+b,0), 200)
})

test('daily queue sorts overdue before new words and excludes future reviews', () => {
  let progress = recordAnswer({}, words[0], true, { mode: 'write', now: noon })
  progress = recordAnswer(progress, words[1], false, { now: noon - 2 * DAY })
  const batch = dailyBatch(words, progress, 20, noon, () => 0.5)
  assert.equal(batch[0].id, words[1].id)
  assert.equal(batch.some(word=>word.id === words[0].id), false)
  assert.equal(batch.length, 20)
  const onlyFuture = dailyBatch([words[0]], progress, 20, noon)
  assert.deepEqual(onlyFuture, [])
})

test('delayed replay follows three distinct words, with scoped end-of-session fillers and a bound', () => {
  const queue = words.slice(0, 5).map(word=>({ word, mode: 'write', replay: false, filler: false }))
  const next = enqueueReview(queue, 0, words.slice(0, 5), ()=>0.5)
  assert.equal(next[4].word.id, words[0].id)
  assert.equal(next[4].replay, true)
  assert.equal(new Set(next.slice(1,4).map(item=>item.word.id)).size, 3)
  const last = enqueueReview(queue, 4, words.slice(0, 5), ()=>0.5)
  assert.equal(last.length, 9)
  assert.equal(last.at(-1).word.id, words[4].id)
  assert.ok(last.slice(5,8).every(item=>item.filler))
  assert.equal(enqueueReview(last, last.length-1, words), last)
  const one = [queue[0]]
  assert.equal(enqueueReview(one,0,[words[0]]),one)
  assert.equal(queue.length,5)
})

test('mixed-photo selection covers all chosen photos without duplicate IDs', () => {
  for (const sources of [['IMG_0225.HEIC','IMG_0227.HEIC'], photoSets(words).map(photo=>photo.id)]) {
    const batch = mixedBatch(words,sources,20,()=>0.5)
    assert.equal(batch.length,20)
    assert.equal(new Set(batch.map(word=>word.id)).size,20)
    assert.equal(new Set(batch.map(word=>word.source)).size,sources.length)
  }
  assert.deepEqual(mixedBatch(words,['IMG_0225.HEIC']),[])
})

test('the 15 photos still partition the same 200 entries in printed order', () => {
  const photos = photoSets(words)
  assert.equal(photos.length,15)
  assert.equal(new Set(photos.flatMap(photo=>scopeWords(words,photo.id).map(word=>word.id))).size,200)
  assert.equal(scopeWords(words,'IMG_0228.HEIC').length,0)
})
