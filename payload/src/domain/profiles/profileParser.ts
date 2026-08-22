import {
  BASE_CHARACTERISTICS,
  PROFILE_PARSER_VERSION,
  type BaseCharacteristic,
  type CanonicalModelProfile,
  type LegacyProfileRow,
  type ProfileValue,
} from './profileTypes';
import {
  makeCanonicalProfileIdentity,
  normalizeProfileOwner,
  normalizedProfileName,
} from './profileIdentity';

export interface StrictProfileParseContext {
  factionId: string;
  compositionId: string;
  rosterUnitId: string;
  rulesUnitId: string;
  sourcePath: string;
  sourceRevision?: string | null;
  fetchedAt?: string;
}

function text(value: unknown): string {
  return String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function headerKey(value: unknown): BaseCharacteristic | null {
  const key = text(value).replace(/[.:]/g, '').toUpperCase();
  return (BASE_CHARACTERISTICS as readonly string[]).includes(key)
    ? (key as BaseCharacteristic)
    : null;
}

function profileValue(value: unknown): ProfileValue {
  const clean = text(value);
  if (!clean || /^[—–-]+$/.test(clean)) return '—';
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
  return clean;
}

function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function slug(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function validateCharacteristicRecord(
  candidate: Record<string, unknown>,
): Record<BaseCharacteristic, ProfileValue> {
  const out = {} as Record<BaseCharacteristic, ProfileValue>;
  for (const key of BASE_CHARACTERISTICS) {
    if (!(key in candidate)) {
      throw new Error(`Profile is missing required characteristic ${key}.`);
    }
    out[key] = profileValue(candidate[key]);
  }
  return out;
}

export function parseStrictCharacteristicTables(
  html: string,
  context: StrictProfileParseContext,
): CanonicalModelProfile[] {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is unavailable; canonical profile parsing cannot continue.');
  }

  const dom = new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html');
  const tables = [...dom.querySelectorAll('table')];
  const results: CanonicalModelProfile[] = [];
  const usedProfileIds = new Set<string>();
  const contentHash = stableHash(html);

  for (const table of tables) {
    const rows = [...table.querySelectorAll('tr')];
    if (rows.length < 2) continue;

    let headerRowIndex = -1;
    let statColumns = new Map<BaseCharacteristic, number>();

    for (let r = 0; r < Math.min(rows.length, 4); r += 1) {
      const cells = [...rows[r].querySelectorAll('th,td')].map((cell) => text(cell.textContent));
      const map = new Map<BaseCharacteristic, number>();
      cells.forEach((cell, index) => {
        const key = headerKey(cell);
        if (key) {
          if (map.has(key)) throw new Error(`Duplicate ${key} characteristic header.`);
          map.set(key, index);
        }
      });
      if (BASE_CHARACTERISTICS.every((key) => map.has(key))) {
        headerRowIndex = r;
        statColumns = map;
        break;
      }
    }

    if (headerRowIndex < 0) continue;

    const firstStatColumn = Math.min(...[...statColumns.values()]);
    const nameColumn = firstStatColumn > 0 ? firstStatColumn - 1 : null;

    for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
      const cells = [...rows[r].querySelectorAll('th,td')].map((cell) => text(cell.textContent));
      if (!cells.length) continue;

      const values = {} as Record<BaseCharacteristic, ProfileValue>;
      let meaningful = 0;
      for (const key of BASE_CHARACTERISTICS) {
        const column = statColumns.get(key);
        if (column === undefined || column >= cells.length) {
          throw new Error(`Malformed characteristic row: missing ${key} cell.`);
        }
        values[key] = profileValue(cells[column]);
        if (values[key] !== '—') meaningful += 1;
      }
      if (meaningful < 5) continue;

      const rawName = nameColumn === null ? '' : cells[nameColumn];
      const profileName = rawName || context.rosterUnitId;
      let profileId =
        slug(rows[r].getAttribute('data-profile-id'))
        || slug(profileName)
        || `profile-${r}`;

      if (usedProfileIds.has(profileId)) {
        throw new Error(`Ambiguous characteristic source: duplicate profile id "${profileId}".`);
      }
      usedProfileIds.add(profileId);

      const identity = makeCanonicalProfileIdentity({
        factionId: context.factionId,
        compositionId: context.compositionId,
        rosterUnitId: context.rosterUnitId,
        rulesUnitId: context.rulesUnitId,
        profileId,
        profileName,
        owner: normalizeProfileOwner(rows[r].getAttribute('data-owner')),
      });

      results.push({
        identity,
        name: profileName,
        characteristics: Object.freeze({ ...values }),
        saves: Object.freeze({}),
        provenance: Object.freeze({
          sourcePath: context.sourcePath,
          sourceRevision: context.sourceRevision || contentHash,
          fetchedAt: context.fetchedAt || new Date().toISOString(),
          parserVersion: PROFILE_PARSER_VERSION,
          contentHash,
        }),
      });
    }
  }

  if (!results.length) {
    throw new Error(`No complete ${BASE_CHARACTERISTICS.join('/')} characteristic table was found.`);
  }

  return results;
}

export function strictProfilesFromLegacyRows(
  rows: LegacyProfileRow[],
  context: StrictProfileParseContext,
): CanonicalModelProfile[] {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error('No legacy profile rows were supplied.');
  }

  const seen = new Set<string>();
  return rows.map((row, index) => {
    const source = (row.profile || row.stats || {}) as Record<string, unknown>;
    const characteristics = validateCharacteristicRecord(source);
    const name = text(row.name) || context.rosterUnitId;
    const profileId = slug(row.id || name || `profile-${index}`);
    if (!profileId || seen.has(profileId)) {
      throw new Error(`Ambiguous legacy profile id "${profileId || '(blank)'}".`);
    }
    seen.add(profileId);

    return {
      identity: makeCanonicalProfileIdentity({
        factionId: context.factionId,
        compositionId: context.compositionId,
        rosterUnitId: context.rosterUnitId,
        rulesUnitId: context.rulesUnitId,
        profileId,
        profileName: name,
        owner: row.owner,
      }),
      name,
      characteristics: Object.freeze({ ...characteristics }),
      saves: Object.freeze({}),
      provenance: Object.freeze({
        sourcePath: context.sourcePath,
        sourceRevision: context.sourceRevision || 'legacy-ingress',
        fetchedAt: context.fetchedAt || new Date().toISOString(),
        parserVersion: PROFILE_PARSER_VERSION,
        contentHash: stableHash(JSON.stringify(row)),
      }),
    };
  });
}

export function selectCanonicalPrimaryProfile(
  unitName: string,
  unitId: string,
  profiles: CanonicalModelProfile[],
): CanonicalModelProfile | null {
  if (!profiles.length) return null;

  const normalizedUnit = normalizedProfileName(unitName);
  const normalizedId = normalizedProfileName(unitId);

  const idMatches = profiles.filter((profile) =>
    normalizedProfileName(profile.identity.profileId) === normalizedId,
  );
  if (idMatches.length === 1) return idMatches[0];

  const exactName = profiles.filter(
    (profile) => normalizedProfileName(profile.name) === normalizedUnit,
  );
  if (exactName.length === 1) return exactName[0];

  if (profiles.length === 1) return profiles[0];
  return null;
}
