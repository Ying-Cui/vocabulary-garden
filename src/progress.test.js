import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordAnswer, summarizeProgress, wordStatus } from './progress.js'
import { photoSets, scopeWords } from './scopes.js'

const words = JSON.parse(readFileSync(new URL('./vocabulary-v2.json', import.meta.url), 'utf8'))

test('a correct new answer resolves weakness; the categories never overlap', () => {
  let progress = {}
  for (let i = 0; i < 12; i++) progress = recordAnswer(progress, words[0], false)
  assert.equal(wordStatus(progress[words[0].id]), 'weak')
  progress = recordAnswer(progress, words[0], true)
  assert.equal(wordStatus(progress[words[0].id]), 'mastered')
  assert.equal(progress[words[0].id].wrong, 12) // historical evidence remains
  assert.deepEqual(summarizeProgress(words, progress), { mastered: 1, weak: 0, unseen: 199 })
  progress = recordAnswer(progress, words[0], false)
  assert.deepEqual(summarizeProgress(words, progress), { mastered: 0, weak: 1, unseen: 199 })
})

test('summary covers the current vocabulary exactly and ignores obsolete IDs', () => {
  let progress = { 'retired-word': { seen: 100, correct: 100, wrong: 0 } }
  words.forEach((word, i) => { if (i % 3 !== 0) progress = recordAnswer(progress, word, i % 3 === 1) })
  const summary = summarizeProgress(words, progress)
  assert.equal(summary.mastered + summary.weak + summary.unseen, 200)
  assert.deepEqual(summary, { mastered: 67, weak: 66, unseen: 67 })
})

test('legacy totals are preserved and interpreted conservatively until the next answer', () => {
  assert.equal(wordStatus({ correct: 10, wrong: 1, seen: 11 }), 'weak')
  assert.equal(wordStatus({ correct: 1, wrong: 0, seen: 1 }), 'mastered')
  assert.equal(wordStatus({ seen: 0, correct: 0, wrong: 0 }), 'unseen')
  assert.equal(wordStatus(null), 'unseen')
  const legacy = { [words[0].id]: { seen: 11, correct: 10, wrong: 1 } }
  const recovered = recordAnswer(legacy, words[0], true)
  assert.equal(wordStatus(recovered[words[0].id]), 'mastered')
  assert.deepEqual(legacy[words[0].id], { seen: 11, correct: 10, wrong: 1 })
})

test('the 15 source photos partition all 200 entries, in printed order', () => {
  const photos = photoSets(words)
  assert.equal(photos.length, 15)
  const selected = photos.flatMap(photo => {
    const group = scopeWords(words, photo.id)
    assert.equal(group.length, photo.count)
    assert.deepEqual(group.map(word => word.row), Array.from({ length: group.length }, (_, index) => index + 1))
    return group.map(word => word.id)
  })
  assert.equal(selected.length, 200)
  assert.equal(new Set(selected).size, 200)
  assert.deepEqual(scopeWords(words, 'all'), words)
  assert.equal(scopeWords(words, 'IMG_0225.HEIC').length, 15)
  assert.equal(scopeWords(words, 'IMG_0227.HEIC').length, 10)
  assert.equal(scopeWords(words, 'IMG_0228.HEIC').length, 0) // test sheet is not an extra list
})
