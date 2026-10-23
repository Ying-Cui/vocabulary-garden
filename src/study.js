export function normalizeAnswer(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'")
    .replace(/[?.!~～]/g, '').trim().replace(/\s+/g, ' ')
}

export function acceptsAnswer(value, word, vocabulary) {
  // Identical printed Japanese meanings (journey/trip) accept either spelling.
  return vocabulary.some(candidate => candidate.japanese === word.japanese &&
    normalizeAnswer(value) === normalizeAnswer(candidate.english))
}

function shuffle(items, random) {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function createOptions(word, vocabulary, random = Math.random) {
  const meanings = new Set([word.japanese])
  const alternatives = shuffle(vocabulary, random).filter(candidate => {
    if (normalizeAnswer(candidate.english) === normalizeAnswer(word.english) ||
        meanings.has(candidate.japanese)) return false
    meanings.add(candidate.japanese)
    return true
  }).slice(0, 3)
  return shuffle([word, ...alternatives], random)
}
