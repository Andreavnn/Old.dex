export const PROFILE_SCHEMA_VERSION = 2 as const;
export const PROFILE_PARSER_VERSION = 'odx-profile-parser-v2' as const;

export const BASE_CHARACTERISTICS = [
  'M', 'WS', 'BS', 'S', 'T', 'W', 'I', 'A', 'Ld',
] as const;

export const SAVE_CHARACTERISTICS = ['Sv', 'Ward', 'Rn'] as const;

export type BaseCharacteristic = typeof BASE_CHARACTERISTICS[number];
export type SaveCharacteristic = typeof SAVE_CHARACTERISTICS[number];
export type ModelStat = BaseCharacteristic | SaveCharacteristic;
export type ProfileValue = number | string;

export type ProfileOwner =
  | 'model'
  | 'rider'
  | 'mount'
  | 'crew'
  | 'champion'
  | 'vehicle'
  | 'other';

export interface CanonicalProfileIdentity {
  factionId: string;
  compositionId: string;
  rosterUnitId: string;
  rulesUnitId: string;
  profileId: string;
  owner: ProfileOwner;
}

export interface ProfileProvenance {
  sourcePath: string;
  sourceRevision: string;
  fetchedAt: string;
  parserVersion: typeof PROFILE_PARSER_VERSION;
  contentHash: string;
}

export interface CanonicalModelProfile {
  identity: CanonicalProfileIdentity;
  name: string;
  characteristics: Readonly<Record<BaseCharacteristic, ProfileValue>>;
  saves: Readonly<Partial<Record<SaveCharacteristic, ProfileValue>>>;
  provenance: Readonly<ProfileProvenance>;
}

export type PersistentModifierOperation = 'add' | 'set' | 'improve-save';

export interface PersistentModelModifier {
  id: string;
  sourceName: string;
  duration: 'match';
  target: 'model';
  stat: ModelStat;
  operation: PersistentModifierOperation;
  value: number | string;
}

export interface WeaponProfileModifier {
  id: string;
  sourceName: string;
  target: 'weapon';
  weaponId?: string;
  appliesTo: 'one-weapon' | 'all-model-weapons';
  property: 'S' | 'AP' | 'A' | 'range' | 'rule';
  operation: 'add' | 'set' | 'append-rule';
  value: number | string;
}

export interface ResolvedDisplayedProfile {
  base: CanonicalModelProfile;
  characteristics: Readonly<Record<BaseCharacteristic, ProfileValue>>;
  saves: Readonly<Partial<Record<SaveCharacteristic, ProfileValue>>>;
  appliedModifiers: ReadonlyArray<PersistentModelModifier>;
}

export interface LegacyProfileRow {
  id?: string;
  name?: string;
  owner?: string;
  profile?: Record<string, unknown>;
  stats?: Record<string, unknown>;
}
