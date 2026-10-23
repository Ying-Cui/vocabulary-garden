export function photoSets(vocabulary) {
  const sources = [...new Set(vocabulary.map(word => word.source))]
  return sources.map((source, index) => {
    const words = vocabulary.filter(word => word.source === source)
    return {
      id: source,
      label: `写真${index + 1}`,
      filename: source,
      count: words.length,
      pages: [...new Set(words.map(word => word.page))],
      first: words[0].english,
      last: words.at(-1).english
    }
  })
}

export function scopeWords(vocabulary, scope) {
  return scope === 'all' ? vocabulary : vocabulary.filter(word => word.source === scope)
}
