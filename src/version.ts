/** Single runtime source for the public Old.dex application build number. */
export const OLDDEX_VERSION = '0.53' as const
export const OLDDEX_BUILD_LABEL = `Alpha Build ${OLDDEX_VERSION}` as const

/**
 * Saved roster JSON schema identifier. This is intentionally independent from
 * OLDDEX_VERSION and is retained for compatibility with existing exported files.
 */
export const OLDDEX_ROSTER_EXPORT_SCHEMA_VERSION = '0.65' as const
