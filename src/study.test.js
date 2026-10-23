import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { acceptsAnswer, createOptions, normalizeAnswer } from './study.js'
import { STORAGE_KEY } from './data.js'

const words = JSON.parse(readFileSync(new URL('./vocabulary-v2.json', import.meta.url), 'utf8'))

test('all five photographed ranges are complete, with independent IDs for both senses of take', () => {
  assert.equal(words.length, 200)
  assert.equal(new Set(words.map(w => w.id)).size, 200)
  assert.equal(new Set(words.map(w => w.source)).size, 15)
  for (let group = 1; group <= 5; group++) {
    assert.equal(words.filter(w => w.group === group).length, 40)
  }
  assert.equal(words.filter(w => w.english === 'take').length, 2)
  assert.notEqual(STORAGE_KEY, 'kotoba-garden-v1')
})

test('every quiz has four distinct meanings and excludes alternate senses of its spelling', () => {
  let seed = 42
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32)
  for (const word of words) {
    for (let i = 0; i < 20; i++) {
      const options = createOptions(word, words, random)
      assert.equal(options.length, 4)
      assert.equal(options.filter(w => w.id === word.id).length, 1)
      assert.equal(new Set(options.map(w => w.japanese)).size, 4)
      assert.equal(options.filter(w => normalizeAnswer(w.english) === normalizeAnswer(word.english)).length, 1)
    }
  }
})

test('typing accepts optional placeholders and punctuation, and identical printed meanings', () => {
  const find = english => words.find(w => w.english === english)
  assert.ok(acceptsAnswer(' TAKE for a walk ', find('take ~ for a walk'), words))
  assert.ok(acceptsAnswer('call back', find('call back ~'), words))
  assert.ok(acceptsAnswer('I’d love to!', find("I'd love to."), words))
  assert.ok(acceptsAnswer('trip', find('journey'), words))
  assert.ok(acceptsAnswer('journey', find('trip'), words))
  assert.equal(acceptsAnswer('travel', find('journey'), words), false)
  assert.equal(acceptsAnswer('', find('take ~ for a walk'), words), false)
})
