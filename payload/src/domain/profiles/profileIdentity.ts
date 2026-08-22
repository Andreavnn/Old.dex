import type {
  CanonicalProfileIdentity,
  LegacyProfileRow,
  ProfileOwner,
} from './profileTypes';

function slug(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizedProfileName(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:the|a|an)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeProfileOwner(value: unknown): ProfileOwner {
  const owner = String(value ?? '').toLowerCase();
  if (owner === 'rider') return 'rider';
  if (owner === 'mount') return 'mount';
  if (owner === 'crew') return 'crew';
  if (owner === 'champion') return 'champion';
  if (owner === 'vehicle') return 'vehicle';
  if (owner === 'model') return 'model';
  return 'other';
}

export function makeCanonicalProfileIdentity(input: {
  factionId: string;
  compositionId: string;
  rosterUnitId: string;
  rulesUnitId?: string;
  profileId?: string;
  profileName?: string;
  owner?: unknown;
}): CanonicalProfileIdentity {
  const rosterUnitId = slug(input.rosterUnitId);
  const rulesUnitId = slug(input.rulesUnitId || input.rosterUnitId);
  const profileId = slug(input.profileId || input.profileName || rulesUnitId);
  if (!input.factionId || !input.compositionId || !rosterUnitId || !rulesUnitId || !profileId) {
    throw new Error('Canonical profile identity is incomplete.');
  }
  return {
    factionId: slug(input.factionId),
    compositionId: slug(input.compositionId),
    rosterUnitId,
    rulesUnitId,
    profileId,
    owner: normalizeProfileOwner(input.owner),
  };
}

export function selectExactLegacyProfile(
  unitName: string,
  unitId: string,
  rows: LegacyProfileRow[],
): LegacyProfileRow | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const wantedId = slug(unitId);
  const wantedName = normalizedProfileName(unitName);

  const idMatches = rows.filter((row) => slug(row.id) === wantedId);
  if (idMatches.length === 1) return idMatches[0];

  const nameMatches = rows.filter(
    (row) => normalizedProfileName(row.name) === wantedName,
  );
  if (nameMatches.length === 1) return nameMatches[0];

  if (rows.length === 1) return rows[0];
  return null;
}
