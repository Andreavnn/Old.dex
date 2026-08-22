import {
  PROFILE_PARSER_VERSION,
  PROFILE_SCHEMA_VERSION,
  type CanonicalModelProfile,
  type CanonicalProfileIdentity,
} from './profileTypes';

const CACHE_PREFIX = 'olddex.canonical-profile.v2:';
const LEGACY_PREFIXES = [
  'olddex.rule-content.preview.',
  'olddex.rule-content.',
  'olddex.builder-profile.',
  'olddex.profile.',
];

function keyPart(value: string): string {
  return encodeURIComponent(value || '-');
}

export function canonicalProfileCacheKey(
  identity: CanonicalProfileIdentity,
  sourceRevision: string,
  contentHash: string,
): string {
  return [
    CACHE_PREFIX,
    PROFILE_SCHEMA_VERSION,
    PROFILE_PARSER_VERSION,
    keyPart(identity.factionId),
    keyPart(identity.compositionId),
    keyPart(identity.rosterUnitId),
    keyPart(identity.rulesUnitId),
    keyPart(identity.profileId),
    keyPart(sourceRevision),
    keyPart(contentHash),
  ].join(':');
}

export function clearLegacyProfileCaches(storage: Storage = localStorage): number {
  const remove: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;
    if (LEGACY_PREFIXES.some((prefix) => key.startsWith(prefix))) remove.push(key);
  }
  remove.forEach((key) => storage.removeItem(key));
  return remove.length;
}

export function writeCanonicalProfileCache(
  profile: CanonicalModelProfile,
  storage: Storage = localStorage,
): void {
  const key = canonicalProfileCacheKey(
    profile.identity,
    profile.provenance.sourceRevision,
    profile.provenance.contentHash,
  );
  storage.setItem(key, JSON.stringify({
    schemaVersion: PROFILE_SCHEMA_VERSION,
    parserVersion: PROFILE_PARSER_VERSION,
    profile,
  }));
}

export function readCanonicalProfileCache(
  identity: CanonicalProfileIdentity,
  sourceRevision: string,
  contentHash: string,
  storage: Storage = localStorage,
): CanonicalModelProfile | null {
  const key = canonicalProfileCacheKey(identity, sourceRevision, contentHash);
  const raw = storage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed?.schemaVersion !== PROFILE_SCHEMA_VERSION
      || parsed?.parserVersion !== PROFILE_PARSER_VERSION
      || !parsed?.profile?.identity
      || !parsed?.profile?.provenance
    ) return null;
    return parsed.profile as CanonicalModelProfile;
  } catch {
    return null;
  }
}
