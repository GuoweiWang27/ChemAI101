import rawProfiles from './animation-profiles.json' with { type: 'json' };
import type {
  ReactionAnimationChemistrySignoff,
  ReactionAnimationEnvironment,
  ReactionAnimationEvidence,
  ReactionAnimationFamily,
  ReactionAnimationMappingReview,
  ReactionAnimationQualityLevel,
  ReactionAnimationEffectKind,
} from './schema';

export interface ReactionAnimationProfileEffect {
  kind: ReactionAnimationEffectKind;
  params: Record<string, string | number | boolean | number[] | string[]>;
}

export interface ReactionAnimationProfile {
  reactionId: string;
  primaryFamily: ReactionAnimationFamily;
  environment: ReactionAnimationEnvironment;
  effects: ReactionAnimationProfileEffect[];
  stateCues: string[];
  phenomena: string[];
  qualityLevel: ReactionAnimationQualityLevel;
  illustrativeOnly: boolean;
  mappingReview: ReactionAnimationMappingReview;
  chemistrySignoff: ReactionAnimationChemistrySignoff;
  evidence?: ReactionAnimationEvidence[];
}

const PROFILE_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const FAMILIES: readonly ReactionAnimationFamily[] = [
  'ionic', 'combustion', 'gas-evolution', 'precipitation-color', 'organic-bond', 'generic',
];
const ENVIRONMENTS: readonly ReactionAnimationEnvironment[] = [
  'none', 'water-beaker', 'flame', 'gas-jar', 'solution', 'organic-vessel',
];
const EFFECTS: readonly ReactionAnimationEffectKind[] = [
  'heat-glow', 'gas-bubbles', 'precipitate-cloud', 'solution-color', 'ion-field',
  'electron-path', 'bond-rewire', 'particle-smoke',
];
const QUALITY_LEVELS: readonly ReactionAnimationQualityLevel[] = ['L0', 'L1', 'L2', 'L3'];
const MAPPING_STATUSES: readonly ReactionAnimationMappingReview['status'][] = [
  'complete', 'incomplete', 'missing', 'not-applicable',
];
const SIGNOFF_STATUSES: readonly ReactionAnimationChemistrySignoff['status'][] = [
  'approved', 'pending', 'rejected',
];

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid reaction animation profile at ${path}: ${message}`);
}

function requiredRecord(value: unknown, path: string): UnknownRecord {
  if (!isRecord(value)) fail(path, 'expected an object');
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(path, 'expected a non-empty string');
  return value;
}

function requiredStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    fail(path, 'expected an array of non-empty strings');
  }
  return value as string[];
}

function requiredEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    fail(path, `expected one of ${values.join(', ')}`);
  }
  return value as T;
}

function validateParams(value: unknown, path: string): Record<string, string | number | boolean | number[] | string[]> {
  const record = requiredRecord(value, path);
  for (const [key, item] of Object.entries(record)) {
    const itemPath = `${path}.${key}`;
    if (typeof item === 'string' || typeof item === 'boolean') continue;
    if (typeof item === 'number' && Number.isFinite(item)) continue;
    if (Array.isArray(item) && item.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) continue;
    if (Array.isArray(item) && item.every((entry) => typeof entry === 'string')) continue;
    fail(itemPath, 'expected a string, finite number, boolean, number[], or string[]');
  }
  return record as Record<string, string | number | boolean | number[] | string[]>;
}

function validateReview(value: unknown, path: string): ReactionAnimationMappingReview {
  const record = requiredRecord(value, path);
  requiredEnum(record.status, MAPPING_STATUSES, `${path}.status`);
  for (const key of ['reviewedAt', 'reviewer', 'note']) {
    if (record[key] !== undefined) requiredString(record[key], `${path}.${key}`);
  }
  return record as unknown as ReactionAnimationMappingReview;
}

function validateSignoff(value: unknown, path: string): ReactionAnimationChemistrySignoff {
  const record = requiredRecord(value, path);
  requiredEnum(record.status, SIGNOFF_STATUSES, `${path}.status`);
  for (const key of ['reviewedAt', 'reviewer', 'note']) {
    if (record[key] !== undefined) requiredString(record[key], `${path}.${key}`);
  }
  return record as unknown as ReactionAnimationChemistrySignoff;
}

function validateEvidence(value: unknown, path: string): ReactionAnimationEvidence[] {
  if (!Array.isArray(value)) fail(path, 'expected an array');
  value.forEach((item, index) => {
    const record = requiredRecord(item, `${path}[${index}]`);
    requiredString(record.id, `${path}[${index}].id`);
    requiredString(record.label, `${path}[${index}].label`);
    for (const key of ['url', 'note']) {
      if (record[key] !== undefined) requiredString(record[key], `${path}[${index}].${key}`);
    }
  });
  return value as ReactionAnimationEvidence[];
}

function validateProfile(value: unknown, index: number): ReactionAnimationProfile {
  const path = `profiles[${index}]`;
  const record = requiredRecord(value, path);
  const reactionId = requiredString(record.reactionId, `${path}.reactionId`);
  if (!PROFILE_ID_PATTERN.test(reactionId)) fail(`${path}.reactionId`, 'must be a lowercase slug');
  requiredEnum(record.primaryFamily, FAMILIES, `${path}.primaryFamily`);
  requiredEnum(record.environment, ENVIRONMENTS, `${path}.environment`);
  if (!Array.isArray(record.effects)) fail(`${path}.effects`, 'expected an array');
  record.effects.forEach((item, effectIndex) => {
    const effectPath = `${path}.effects[${effectIndex}]`;
    const effect = requiredRecord(item, effectPath);
    requiredEnum(effect.kind, EFFECTS, `${effectPath}.kind`);
    validateParams(effect.params, `${effectPath}.params`);
  });
  requiredStringArray(record.stateCues, `${path}.stateCues`);
  requiredStringArray(record.phenomena, `${path}.phenomena`);
  requiredEnum(record.qualityLevel, QUALITY_LEVELS, `${path}.qualityLevel`);
  if (typeof record.illustrativeOnly !== 'boolean') fail(`${path}.illustrativeOnly`, 'expected a boolean');
  validateReview(record.mappingReview, `${path}.mappingReview`);
  validateSignoff(record.chemistrySignoff, `${path}.chemistrySignoff`);
  if (record.evidence !== undefined) validateEvidence(record.evidence, `${path}.evidence`);
  return record as unknown as ReactionAnimationProfile;
}

/** JSON is an untrusted runtime input; the TS interface is not a substitute for this check. */
export function parseAnimationProfiles(raw: unknown): ReactionAnimationProfile[] {
  if (!Array.isArray(raw)) fail('profiles', 'expected an array');
  const profiles = raw.map((value, index) => validateProfile(value, index));
  const ids = profiles.map((profile) => profile.reactionId);
  if (new Set(ids).size !== ids.length) fail('profiles', 'reactionId values must be unique');
  return profiles;
}

export const ANIMATION_PROFILES = parseAnimationProfiles(rawProfiles);

const BY_REACTION_ID = new Map(
  ANIMATION_PROFILES.map((profile) => [profile.reactionId, profile]),
);

export function getAnimationProfile(reactionId: string): ReactionAnimationProfile | undefined {
  return BY_REACTION_ID.get(reactionId);
}
