export function wordStatus(record) {
  if (!record || typeof record !== 'object') return 'unseen'
  if (typeof record.lastCorrect === 'boolean') return record.lastCorrect ? 'mastered' : 'weak'
  // Earlier v2 records have totals but no answer order. Do not infer a recovery.
  if (Number.isFinite(record.wrong) && record.wrong > 0) return 'weak'
  if (Number.isFinite(record.correct) && record.correct > 0) return 'mastered'
  return 'unseen'
}

export function summarizeProgress(vocabulary, progress) {
  const summary = { mastered: 0, weak: 0, unseen: 0 }
  for (const word of vocabulary) summary[wordStatus(progress[word.id])]++
  return summary
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function recordAnswer(progress, word, correct) {
  const previous = progress[word.id] || {}
  return { ...progress, [word.id]: {
    seen: count(previous.seen) + 1,
    correct: count(previous.correct) + (correct ? 1 : 0),
    wrong: count(previous.wrong) + (correct ? 0 : 1),
    lastCorrect: correct
  } }
}
