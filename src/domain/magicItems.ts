export function magicItemPointLimit(optionIds: Iterable<string>) {
  const options = optionIds instanceof Set ? optionIds : new Set(optionIds)
  if (options.has('limit-magical-items-50')) return 50
  if (options.has('limit-magical-items-75')) return 74
  return Number.POSITIVE_INFINITY
}

export function magicItemLimitLabel(limit: number) {
  if (limit === 50) return '50 points or less'
  if (limit === 74) return 'less than 75 points'
  return ''
}
