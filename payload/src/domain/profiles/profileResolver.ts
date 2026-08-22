import {
  BASE_CHARACTERISTICS,
  SAVE_CHARACTERISTICS,
  type BaseCharacteristic,
  type CanonicalModelProfile,
  type ModelStat,
  type PersistentModelModifier,
  type ProfileValue,
  type ResolvedDisplayedProfile,
  type SaveCharacteristic,
  type WeaponProfileModifier,
} from './profileTypes';

function numeric(value: ProfileValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return Number(value);
  }
  return null;
}

function isBaseStat(stat: ModelStat): stat is BaseCharacteristic {
  return (BASE_CHARACTERISTICS as readonly string[]).includes(stat);
}

function isSaveStat(stat: ModelStat): stat is SaveCharacteristic {
  return (SAVE_CHARACTERISTICS as readonly string[]).includes(stat);
}

function applyValue(
  current: ProfileValue | undefined,
  modifier: PersistentModelModifier,
): ProfileValue {
  if (modifier.operation === 'set') return modifier.value;

  const cur = numeric(current);
  const amount = typeof modifier.value === 'number'
    ? modifier.value
    : Number(modifier.value);

  if (!Number.isFinite(amount)) {
    throw new Error(`Persistent modifier "${modifier.sourceName}" has a non-numeric value.`);
  }

  if (modifier.operation === 'add') {
    if (cur === null) {
      throw new Error(`Cannot add ${amount} to non-numeric ${modifier.stat}.`);
    }
    return cur + amount;
  }

  if (modifier.operation === 'improve-save') {
    if (!isSaveStat(modifier.stat)) {
      throw new Error('improve-save may only target Sv, Ward, or Rn.');
    }
    if (cur === null) return current ?? '—';
    return Math.max(2, cur - Math.abs(amount));
  }

  return current ?? '—';
}

export function resolveDisplayedProfile(
  base: CanonicalModelProfile,
  modifiers: readonly PersistentModelModifier[],
): ResolvedDisplayedProfile {
  const characteristics = { ...base.characteristics };
  const saves = { ...base.saves };
  const applied: PersistentModelModifier[] = [];

  for (const modifier of modifiers) {
    if (modifier.duration !== 'match' || modifier.target !== 'model') continue;

    if (isBaseStat(modifier.stat)) {
      characteristics[modifier.stat] = applyValue(characteristics[modifier.stat], modifier);
      applied.push(modifier);
      continue;
    }

    if (isSaveStat(modifier.stat)) {
      saves[modifier.stat] = applyValue(saves[modifier.stat], modifier);
      applied.push(modifier);
    }
  }

  return {
    base,
    characteristics: Object.freeze(characteristics),
    saves: Object.freeze(saves),
    appliedModifiers: Object.freeze(applied.slice()),
  };
}

export interface ResolvedWeaponProfile {
  id: string;
  name: string;
  S?: ProfileValue;
  AP?: ProfileValue;
  A?: ProfileValue;
  range?: ProfileValue;
  rules: string[];
}

export function resolveWeaponProfile(
  weapon: ResolvedWeaponProfile,
  modifiers: readonly WeaponProfileModifier[],
): ResolvedWeaponProfile {
  const out: ResolvedWeaponProfile = { ...weapon, rules: [...(weapon.rules || [])] };

  for (const modifier of modifiers) {
    if (modifier.target !== 'weapon') continue;
    if (
      modifier.appliesTo === 'one-weapon'
      && modifier.weaponId
      && modifier.weaponId !== weapon.id
    ) continue;

    if (modifier.property === 'rule') {
      if (modifier.operation !== 'append-rule') continue;
      const rule = String(modifier.value);
      if (rule && !out.rules.includes(rule)) out.rules.push(rule);
      continue;
    }

    const key = modifier.property;
    if (key === 'range') {
      if (modifier.operation === 'set') out.range = modifier.value;
      continue;
    }

    if (modifier.operation === 'set') {
      out[key] = modifier.value;
      continue;
    }

    if (modifier.operation === 'add') {
      const current = numeric(out[key]);
      const amount = Number(modifier.value);
      if (current !== null && Number.isFinite(amount)) out[key] = current + amount;
    }
  }

  return out;
}

export function legacySaveOverridesOnly(
  override: Record<string, unknown> | null | undefined,
): PersistentModelModifier[] {
  if (!override) return [];
  const aliases: Record<string, SaveCharacteristic> = {
    sv: 'Sv',
    save: 'Sv',
    armoursave: 'Sv',
    armorsave: 'Sv',
    ward: 'Ward',
    wardsave: 'Ward',
    rn: 'Rn',
    regeneration: 'Rn',
    regenerationsave: 'Rn',
  };

  const out: PersistentModelModifier[] = [];
  for (const [rawKey, rawValue] of Object.entries(override)) {
    const normalized = rawKey.toLowerCase().replace(/[^a-z]/g, '');
    const stat = aliases[normalized];
    if (!stat) continue;

    if (rawValue === '+1') {
      out.push({
        id: `legacy-save-${normalized}`,
        sourceName: 'Legacy persistent save override',
        duration: 'match',
        target: 'model',
        stat,
        operation: 'improve-save',
        value: 1,
      });
    } else {
      out.push({
        id: `legacy-save-${normalized}`,
        sourceName: 'Legacy persistent save override',
        duration: 'match',
        target: 'model',
        stat,
        operation: 'set',
        value: String(rawValue ?? '—'),
      });
    }
  }
  return out;
}
