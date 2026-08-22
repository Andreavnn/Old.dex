import {
  parseStrictCharacteristicTables,
  selectCanonicalPrimaryProfile,
  strictProfilesFromLegacyRows,
  type StrictProfileParseContext,
} from '../domain/profiles/profileParser';
import type {
  CanonicalModelProfile,
  LegacyProfileRow,
} from '../domain/profiles/profileTypes';

export interface CanonicalProfileRequest {
  factionId: string;
  compositionId: string;
  rosterUnitId: string;
  rulesUnitId: string;
  unitName: string;
}

export interface RuleDocumentLike {
  html: string;
  path: string;
  fetchedAt?: string;
  version?: string | null;
}

export type RuleDocumentFetcher = (
  path: string,
  force?: boolean,
) => Promise<RuleDocumentLike>;

function contextFor(
  request: CanonicalProfileRequest,
  document: RuleDocumentLike,
): StrictProfileParseContext {
  return {
    factionId: request.factionId,
    compositionId: request.compositionId,
    rosterUnitId: request.rosterUnitId,
    rulesUnitId: request.rulesUnitId,
    sourcePath: document.path,
    sourceRevision: document.version || null,
    fetchedAt: document.fetchedAt,
  };
}

export async function resolveCanonicalProfilesFromRules(
  request: CanonicalProfileRequest,
  fetchRuleDocument: RuleDocumentFetcher,
): Promise<{
  profiles: CanonicalModelProfile[];
  primary: CanonicalModelProfile | null;
  source: RuleDocumentLike;
}> {
  const path = `/unit/${encodeURIComponent(request.rulesUnitId)}`;
  const source = await fetchRuleDocument(path, true);
  const profiles = parseStrictCharacteristicTables(source.html, contextFor(request, source));
  const primary = selectCanonicalPrimaryProfile(
    request.unitName,
    request.rosterUnitId,
    profiles,
  );
  return { profiles, primary, source };
}

export function resolveCanonicalProfilesFromLegacy(
  request: CanonicalProfileRequest,
  rows: LegacyProfileRow[],
  sourcePath = 'builder-data',
): {
  profiles: CanonicalModelProfile[];
  primary: CanonicalModelProfile | null;
} {
  const profiles = strictProfilesFromLegacyRows(rows, {
    factionId: request.factionId,
    compositionId: request.compositionId,
    rosterUnitId: request.rosterUnitId,
    rulesUnitId: request.rulesUnitId,
    sourcePath,
    sourceRevision: 'builder-ingress',
  });

  return {
    profiles,
    primary: selectCanonicalPrimaryProfile(
      request.unitName,
      request.rosterUnitId,
      profiles,
    ),
  };
}

export function legacyProfileRows(
  profiles: CanonicalModelProfile[],
): Array<{
  id: string;
  name: string;
  owner: string;
  profile: Record<string, string | number>;
  canonicalIdentity: CanonicalModelProfile['identity'];
  provenance: CanonicalModelProfile['provenance'];
}> {
  return profiles.map((profile) => ({
    id: profile.identity.profileId,
    name: profile.name,
    owner: profile.identity.owner,
    profile: { ...profile.characteristics, ...profile.saves },
    canonicalIdentity: profile.identity,
    provenance: profile.provenance,
  }));
}
