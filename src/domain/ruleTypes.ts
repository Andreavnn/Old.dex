export type RuleDocument = {
  title: string
  sourcePath: string
  html: string
  fetchedAt: string
  transport: 'proxy' | 'direct' | 'reader'
  version?: string
}

export type RuleIndexEntry = {
  name: string
  sourcePath: string
}

export type RuleIndexGroup = {
  name: string
  sourcePath: string
  entries: RuleIndexEntry[]
}
