export const DAY = 24 * 60 * 60 * 1000
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30]
export const STATUS_LABELS = { unseen: '未学習', learning: '練習中', weak: '要復習', mastered: '定着' }

function count(value) { return Number.isSafeInteger(value) && value >= 0 ? value : 0 }
function hasPractice(record) {
  return record && typeof record === 'object' &&
    (count(record.seen) > 0 || count(record.correct) > 0 || count(record.wrong) > 0 || typeof record.lastCorrect === 'boolean')
}
export function localDay(now) {
  const date = new Date(now)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function nextReviewAt(record) {
  if (!hasPractice(record)) return null
  return Number.isFinite(record.nextReviewAt) && record.nextReviewAt > 0 ? record.nextReviewAt : 0
}
export function isDue(record, now = Date.now()) {
  const due = nextReviewAt(record)
  return due !== null && due <= now
}
export function learningStage(record) {
  if (Number.isInteger(record?.stage) && record.stage >= 0 && record.stage <= 3) return record.stage
  return count(record?.correct) > 0 ? 1 : 0
}
export function stageMode(record) { return ['card', 'quiz', 'hint', 'write'][learningStage(record)] }
export function wordStatus(record, now = Date.now()) {
  if (!hasPractice(record)) return 'unseen'
  if (isDue(record, now) || record.needsReview === true || record.lastCorrect === false) return 'weak'
  if (record.schemaVersion === 3 && count(record.reviewStreak) >= 3 && Array.isArray(record.qualifyingDates) && new Set(record.qualifyingDates).size >= 3) return 'mastered'
  return 'learning'
}
export function summarizeProgress(vocabulary, progress, now = Date.now()) {
  const summary = { mastered: 0, weak: 0, learning: 0, unseen: 0 }
  for (const word of vocabulary) summary[wordStatus(progress[word.id], now)]++
  return summary
}

export function recordAnswer(progress, word, correct, options = {}) {
  const { mode = 'card', now = Date.now(), replay = false, hintUsed = false } = options
  const previous = progress[word.id] || {}
  const due = nextReviewAt(previous)
  const eligibleTime = due === null || due <= now
  const date = localDay(now)
  const priorDates = Array.isArray(previous.qualifyingDates) ? previous.qualifyingDates.filter(value => typeof value === 'string') : []
  const independent = correct && mode === 'write' && !hintUsed && !replay
  const qualified = independent && eligibleTime && !priorDates.includes(date)
  const next = {
    ...previous, schemaVersion: 3,
    seen: count(previous.seen) + 1,
    correct: count(previous.correct) + (correct ? 1 : 0),
    wrong: count(previous.wrong) + (correct ? 0 : 1),
    lastCorrect: correct, lastAnsweredAt: now, lastMode: mode,
    stage: learningStage(previous),
    reviewStreak: count(previous.reviewStreak),
    qualifyingDates: priorDates,
    nextReviewAt: due ?? now + DAY,
    needsReview: previous.needsReview ?? previous.lastCorrect === false
  }
  if (!correct) {
    next.stage = Math.max(0, next.stage - 1)
    next.reviewStreak = 0
    next.qualifyingDates = []
    next.needsReview = true
    next.nextReviewAt = now + DAY
  } else if (!replay) {
    next.stage = Math.max(next.stage, { card: 1, quiz: 2, hint: 3, write: 3 }[mode] ?? 0)
    next.needsReview = false
    if (qualified) {
      next.qualifyingDates = [...priorDates, date]
      next.reviewStreak = next.qualifyingDates.length
      next.nextReviewAt = now + REVIEW_INTERVALS[Math.min(next.reviewStreak - 1, REVIEW_INTERVALS.length - 1)] * DAY
    } else if (due === null || (eligibleTime && learningStage(previous) < 3)) {
      // Early-stage practice earns another day of practice, never a retention credit.
      next.nextReviewAt = now + DAY
    }
  }
  return { ...progress, [word.id]: next }
}
