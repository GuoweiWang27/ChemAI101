import type { MoleculeStructure } from '../types';
import type { CuratedReaction, ReactionAnimationScene } from '../src/data/reactions/schema';
import {
  parseAnimationProfiles,
  type ReactionAnimationProfile,
} from '../src/data/reactions/animationProfiles.ts';
import {
  isReactionAnimationConservationEligible,
  type ReactionAnimationGateInput,
} from './reactionAnimationGate.ts';
import { createFallbackReactionAnimation } from './reactionAnimation.ts';
import { FLAGSHIP_MICRO_KINDS } from '../src/data/reactions/flagshipScenes.ts';

export interface ReactionAnimationAuditIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export type ReactionAnimationAuditCheck = 'pass' | 'fail' | 'not-verifiable';

export interface ReactionAnimationAuditEntry {
  reactionId: string;
  declaredQuality: ReactionAnimationProfile['qualityLevel'] | 'missing';
  mappingStatus: 'complete' | 'incomplete' | 'missing';
  unmappedReactantAtoms: string[];
  productIdBijection: ReactionAnimationAuditCheck;
  reactantStoichiometry: ReactionAnimationAuditCheck;
  productStoichiometry: ReactionAnimationAuditCheck;
  equationConservation: ReactionAnimationAuditCheck;
  elementConservation: ReactionAnimationAuditCheck;
  chargeConservation: ReactionAnimationAuditCheck;
  qualityGate: 'pass' | 'illustrative-only' | 'fail';
  issues: ReactionAnimationAuditIssue[];
}

export interface ReactionAnimationAuditReport {
  schemaVersion: 'reaction-animation-audit.v1';
  generatedAt: string;
  summary: {
    reactions: number;
    profiles: number;
    flows: number;
    completeMappings: number;
    incompleteMappings: number;
    missingFlows: number;
    qualityGateFailures: number;
  };
  entries: ReactionAnimationAuditEntry[];
  manifestIssues: ReactionAnimationAuditIssue[];
}

export interface ReactionEquationTerm {
  coefficient: number;
  formula: string;
  atoms: Record<string, number>;
  symbolic: boolean;
}

export interface ReactionEquationSemantics {
  left: ReactionEquationTerm[];
  right: ReactionEquationTerm[];
  leftAtoms: Record<string, number>;
  rightAtoms: Record<string, number>;
  balanced: boolean | null;
  verifiable: boolean;
  issues: string[];
  hardIssues: string[];
}

const issue = (
  code: string,
  message: string,
  severity: ReactionAnimationAuditIssue['severity'] = 'error',
): ReactionAnimationAuditIssue => ({ code, message, severity });

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
  '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
};

const OPEN_TO_CLOSE: Record<string, string> = { '(': ')', '[': ']' };
const FORMULA_SYMBOLIC_PATTERN = /[^A-Za-z0-9()[\]₀₁₂₃₄₅₆₇₈₉=—\-/.·]/;

function addCounts(target: Record<string, number>, source: Record<string, number>, multiplier = 1): void {
  for (const [element, count] of Object.entries(source)) {
    target[element] = (target[element] ?? 0) + count * multiplier;
  }
}

function countsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const elements = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...elements].every((element) => left[element] === right[element]);
}

function readCount(input: string, start: number): { value: number; next: number } {
  let next = start;
  let digits = '';
  while (next < input.length) {
    const raw = input[next];
    const digit = SUBSCRIPT_DIGITS[raw] ?? (/[0-9]/.test(raw) ? raw : undefined);
    if (digit === undefined) break;
    digits += digit;
    next += 1;
  }
  return { value: digits ? Number(digits) : 1, next };
}

function parseFormulaCore(input: string, start = 0, expectedClose?: string): {
  atoms: Record<string, number>;
  next: number;
} {
  const atoms: Record<string, number> = {};
  let next = start;

  while (next < input.length) {
    const char = input[next];
    if (expectedClose && char === expectedClose) return { atoms, next };
    if (char === ')' || char === ']') {
      throw new Error(`unexpected closing bracket ${char}`);
    }
    if (char in OPEN_TO_CLOSE) {
      const close = OPEN_TO_CLOSE[char];
      const group = parseFormulaCore(input, next + 1, close);
      if (input[group.next] !== close) throw new Error(`missing closing bracket ${close}`);
      const count = readCount(input, group.next + 1);
      addCounts(atoms, group.atoms, count.value);
      next = count.next;
      continue;
    }
    if (/[A-Z]/.test(char)) {
      let element = char;
      next += 1;
      if (next < input.length && /[a-z]/.test(input[next])) {
        element += input[next];
        next += 1;
      }
      const count = readCount(input, next);
      atoms[element] = (atoms[element] ?? 0) + count.value;
      next = count.next;
      continue;
    }
    if (char === '=' || char === '—' || char === '-' || char === '/') {
      next += 1;
      continue;
    }
    throw new Error(`unexpected formula character ${char}`);
  }

  if (expectedClose) throw new Error(`missing closing bracket ${expectedClose}`);
  return { atoms, next };
}

function parseFormula(formula: string): { atoms: Record<string, number>; symbolic: boolean } {
  const normalized = formula.replace(/\s/g, '');
  if (!normalized) throw new Error('empty formula');
  if (/\p{Script=Han}/u.test(normalized)) {
    return { atoms: {}, symbolic: true };
  }
  if (FORMULA_SYMBOLIC_PATTERN.test(normalized)) throw new Error('formula contains an unsupported character');

  let symbolic = false;
  const atoms: Record<string, number> = {};
  for (const rawPart of normalized.split(/[·.]/)) {
    if (!rawPart) throw new Error('empty hydrate component');
    let part = rawPart;
    let multiplier = 1;
    const leadingCount = readCount(part, 0);
    if (leadingCount.next > 0 && leadingCount.next < part.length) {
      const first = part[0];
      if (/[0-9]/.test(first)) {
        multiplier = leadingCount.value;
        part = part.slice(leadingCount.next);
      }
    }
    if (part.startsWith('n')) {
      symbolic = true;
      part = part.slice(1);
    }
    if (!part) throw new Error('missing formula after multiplier');
    const parsed = parseFormulaCore(part);
    if (parsed.next !== part.length) throw new Error('formula was not fully consumed');
    addCounts(atoms, parsed.atoms, multiplier);
  }
  return { atoms, symbolic };
}

function stripTermDecoration(rawTerm: string): string {
  return rawTerm
    .trim()
    .replace(/[↑↓]$/, '')
    .replace(/\((?:aq|s|l|g|浓|稀)\)$/i, '')
    .replace(/（(?:aq|s|l|g|浓|稀)）$/i, '')
    .trim();
}

function parseEquationTerm(rawTerm: string): ReactionEquationTerm {
  let term = stripTermDecoration(rawTerm);
  let coefficient = 1;
  const coefficientMatch = term.match(/^(\d+(?:\.\d+)?)\s*/);
  if (coefficientMatch) {
    coefficient = Number(coefficientMatch[1]);
    term = term.slice(coefficientMatch[0].length);
  }
  if (!Number.isFinite(coefficient) || coefficient <= 0) throw new Error('invalid stoichiometric coefficient');

  let symbolic = false;
  if (/^n(?=[A-Z(\[])/.test(term)) {
    symbolic = true;
    term = term.slice(1);
  }
  const parsed = parseFormula(term);
  return { coefficient, formula: term, atoms: parsed.atoms, symbolic: symbolic || parsed.symbolic };
}

function splitEquationSide(side: string): ReactionEquationTerm[] {
  const pieces = side.split(/\s*\+\s*/).map((piece) => piece.trim()).filter(Boolean);
  if (pieces.length === 0) throw new Error('equation side has no terms');
  return pieces.map(parseEquationTerm);
}

/** Parse the complete equation, including every term and its stoichiometric coefficient. */
export function parseReactionEquation(equation: string): ReactionEquationSemantics {
  const issues: string[] = [];
  const hardIssues: string[] = [];
  const arrowMatch = equation.match(/⇌|⟶|→/);
  let separatorIndex = arrowMatch?.index ?? -1;
  let separatorLength = arrowMatch?.[0].length ?? 0;
  if (separatorIndex < 0) {
    const equalsMatch = equation.match(/\s=\s/);
    if (equalsMatch?.index !== undefined) {
      separatorIndex = equalsMatch.index + 1;
      separatorLength = 1;
    }
  }
  if (separatorIndex < 0) {
    const detail = 'Equation has no recognized reaction arrow';
    issues.push(detail);
    hardIssues.push(detail);
    return {
      left: [], right: [], leftAtoms: {}, rightAtoms: {}, balanced: null, verifiable: false, issues, hardIssues,
    };
  }

  let left: ReactionEquationTerm[] = [];
  let right: ReactionEquationTerm[] = [];
  try {
    left = splitEquationSide(equation.slice(0, separatorIndex));
    right = splitEquationSide(equation.slice(separatorIndex + separatorLength));
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unable to parse equation terms';
    issues.push(detail);
    hardIssues.push(detail);
  }

  const leftAtoms: Record<string, number> = {};
  const rightAtoms: Record<string, number> = {};
  for (const term of left) addCounts(leftAtoms, term.atoms, term.coefficient);
  for (const term of right) addCounts(rightAtoms, term.atoms, term.coefficient);
  const symbolic = [...left, ...right].some((term) => term.symbolic);
  if (symbolic) issues.push('Equation contains a symbolic or named term');
  const verifiable = hardIssues.length === 0 && issues.length === 0 && left.length > 0 && right.length > 0;
  return {
    left,
    right,
    leftAtoms,
    rightAtoms,
    balanced: verifiable ? countsEqual(leftAtoms, rightAtoms) : null,
    verifiable,
    issues,
    hardIssues,
  };
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBilingualText(value: unknown): boolean {
  return isRecord(value)
    && typeof value.zh === 'string' && value.zh.trim().length > 0
    && typeof value.en === 'string' && value.en.trim().length > 0;
}

function isTuple3(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber);
}

const FAMILIES = new Set(['ionic', 'combustion', 'gas-evolution', 'precipitation-color', 'organic-bond', 'generic']);
const ENVIRONMENTS = new Set(['none', 'water-beaker', 'flame', 'gas-jar', 'solution', 'organic-vessel']);
const EVENT_KINDS = new Set([
  'observe', 'enter', 'heat', 'electron-transfer', 'bond-break', 'atom-transfer', 'ionize',
  'gas-bubble', 'color-change', 'precipitate', 'bond-form', 'product',
]);
const FOCI = new Set(['reactants', 'change', 'products', 'observation']);
const QUALITY_LEVELS = new Set(['L0', 'L1', 'L2', 'L3']);
const EASINGS = new Set(['linear', 'ease-in', 'ease-out', 'ease-in-out']);
const EFFECT_KINDS = new Set([
  'heat-glow', 'gas-bubbles', 'precipitate-cloud', 'solution-color', 'ion-field',
  'electron-path', 'bond-rewire', 'particle-smoke',
]);
const ACTOR_KINDS = new Set(['species', 'atom', 'ion', 'electron', 'water-surface', 'gas', 'bubble', 'indicator', 'heat']);
const MAPPING_STATUSES = new Set(['complete', 'incomplete', 'missing', 'not-applicable']);
const SIGNOFF_STATUSES = new Set(['approved', 'pending', 'rejected']);
const FLAGSHIP_MACRO_KINDS = new Set([
  'metal-on-water', 'flame', 'smoke', 'solution-color', 'solid-hydration', 'heat-rise',
]);
const FLAGSHIP_MICRO_KIND_SET = new Set<string>(FLAGSHIP_MICRO_KINDS);
const FLAGSHIP_REVIEW_CHEMISTRY_STATUSES = new Set(['pending', 'passed', 'blocked']);
const FLAGSHIP_REVIEW_TEACHER_STATUSES = new Set(['pending', 'reviewed']);

function validateParams(value: unknown, path: string, issues: ReactionAnimationAuditIssue[]): value is UnknownRecord {
  if (!isRecord(value)) {
    issues.push(issue('INVALID_PARAMS_SHAPE', `${path} must be an object`));
    return false;
  }
  for (const [key, item] of Object.entries(value)) {
    const validScalar = typeof item === 'string'
      || typeof item === 'boolean'
      || (typeof item === 'number' && Number.isFinite(item));
    const validArray = Array.isArray(item)
      && (item.every((entry) => typeof entry === 'string')
        || item.every((entry) => typeof entry === 'number' && Number.isFinite(entry)));
    if (!validScalar && !validArray) issues.push(issue('INVALID_PARAMS_VALUE', `${path}.${key} has an invalid value`));
  }
  return true;
}

function validateGateFields(record: UnknownRecord, issues: ReactionAnimationAuditIssue[]): void {
  if (typeof record.illustrativeOnly !== 'boolean') {
    issues.push(issue('INVALID_ILLUSTRATIVE_ONLY', 'Scene illustrativeOnly must be boolean'));
  }
  if (typeof record.qualityLevel !== 'string' || !QUALITY_LEVELS.has(record.qualityLevel)) {
    issues.push(issue('INVALID_QUALITY_LEVEL', 'Scene qualityLevel is invalid'));
  }
  const review = record.mappingReview;
  if (!isRecord(review) || typeof review.status !== 'string' || !MAPPING_STATUSES.has(review.status)) {
    issues.push(issue('INVALID_MAPPING_REVIEW', 'Scene mappingReview.status is invalid'));
  }
  const signoff = record.chemistrySignoff;
  if (!isRecord(signoff) || typeof signoff.status !== 'string' || !SIGNOFF_STATUSES.has(signoff.status)) {
    issues.push(issue('INVALID_CHEMISTRY_SIGNOFF', 'Scene chemistrySignoff.status is invalid'));
  }
}

function stageRange(stages: unknown[], stageId: string): { start: number; end: number } | undefined {
  const stage = stages.find((candidate) => isRecord(candidate) && candidate.id === stageId);
  if (!isRecord(stage) || !isFiniteNumber(stage.start) || !isFiniteNumber(stage.end)) return undefined;
  return { start: stage.start, end: stage.end };
}

function validateFlagshipTrack(
  scene: UnknownRecord,
  stages: unknown[],
  trackName: 'macroTrack' | 'microTrack' | 'equationTrack',
  issues: ReactionAnimationAuditIssue[],
): void {
  const rawTrack = scene[trackName];
  if (!Array.isArray(rawTrack)) {
    issues.push(issue('FLAGSHIP_TRACK_MISSING', `${trackName} must be an array`));
    return;
  }
  const trackStageCounts = new Map<string, number>();
  const trackIds = new Set<string>();
  rawTrack.forEach((rawEvent, index) => {
    if (!isRecord(rawEvent)) {
      issues.push(issue('FLAGSHIP_TRACK_EVENT_INVALID', `${trackName}[${index}] must be an object`));
      return;
    }
    const id = rawEvent.id;
    if (typeof id !== 'string' || id.trim().length === 0) {
      issues.push(issue('FLAGSHIP_TRACK_EVENT_INVALID', `${trackName}[${index}] has an invalid id`));
    } else if (trackIds.has(id)) {
      issues.push(issue('FLAGSHIP_TRACK_DUPLICATE_ID', `Duplicate ${trackName} event ${id}`));
    } else {
      trackIds.add(id);
    }
    const stageId = rawEvent.stageId;
    const range = typeof stageId === 'string' ? stageRange(stages, stageId) : undefined;
    if (typeof stageId !== 'string' || !range) {
      issues.push(issue('FLAGSHIP_TRACK_UNKNOWN_STAGE', `${trackName} event ${String(id)} refers to stage ${String(stageId)}`));
    } else {
      trackStageCounts.set(stageId, (trackStageCounts.get(stageId) ?? 0) + 1);
    }
    if (!isFiniteNumber(rawEvent.at) || !isFiniteNumber(rawEvent.duration)
      || rawEvent.at < 0 || rawEvent.duration <= 0
      || (isFiniteNumber(scene.duration) && rawEvent.at + rawEvent.duration > scene.duration + 0.0001)) {
      issues.push(issue('FLAGSHIP_TRACK_INVALID_RANGE', `Invalid timing for ${trackName} event ${String(id)}`));
    } else if (range && (rawEvent.at < range.start - 0.0001
      || rawEvent.at + rawEvent.duration > range.end + 0.0001)) {
      issues.push(issue('FLAGSHIP_TRACK_OUTSIDE_STAGE', `${trackName} event ${String(id)} is outside stage ${stageId}`));
    }
    if (!isBilingualText(rawEvent.label)) {
      issues.push(issue('FLAGSHIP_TRACK_INVALID_LABEL', `${trackName} event ${String(id)} must have bilingual label`));
    }
    if (typeof rawEvent.kind !== 'string' || rawEvent.kind.trim().length === 0) {
      issues.push(issue('FLAGSHIP_TRACK_INVALID_KIND', `${trackName} event ${String(id)} has an invalid kind`));
    } else if (trackName === 'macroTrack' && !FLAGSHIP_MACRO_KINDS.has(rawEvent.kind)) {
      issues.push(issue('FLAGSHIP_TRACK_INVALID_KIND', `${trackName} event ${String(id)} has an invalid macro kind`));
    } else if (trackName === 'microTrack' && !FLAGSHIP_MICRO_KIND_SET.has(rawEvent.kind)) {
      issues.push(issue('FLAGSHIP_TRACK_INVALID_KIND', `${trackName} event ${String(id)} has an unsupported micro kind`));
    } else if (trackName === 'equationTrack' && !FOCI.has(rawEvent.kind)) {
      issues.push(issue('FLAGSHIP_TRACK_INVALID_KIND', `${trackName} event ${String(id)} has an invalid equation focus`));
    }
    validateParams(rawEvent.params, `${trackName} event ${String(id)}.params`, issues);
  });

  for (const stage of stages) {
    if (!isRecord(stage) || typeof stage.id !== 'string') continue;
    if ((trackStageCounts.get(stage.id) ?? 0) === 0) {
      issues.push(issue('FLAGSHIP_TRACK_STAGE_MISSING', `${trackName} has no event for stage ${stage.id}`));
    }
  }
}

function validateFlagshipRuntime(
  scene: UnknownRecord,
  stages: unknown[],
  issues: ReactionAnimationAuditIssue[],
): void {
  if (stages.length < 4) {
    issues.push(issue('FLAGSHIP_STAGES_MISSING', 'Version 3 scene must contain at least four stages'));
  }
  validateFlagshipTrack(scene, stages, 'macroTrack', issues);
  validateFlagshipTrack(scene, stages, 'microTrack', issues);
  validateFlagshipTrack(scene, stages, 'equationTrack', issues);

  const teachingMoments = scene.teachingMoments;
  if (!Array.isArray(teachingMoments) || teachingMoments.length < 3) {
    issues.push(issue('FLAGSHIP_TEACHING_MOMENTS_MISSING', 'Version 3 scene must contain at least three teaching moments'));
  }
  if (Array.isArray(teachingMoments)) {
    const momentIds = new Set<string>();
    teachingMoments.forEach((rawMoment, index) => {
      if (!isRecord(rawMoment)) {
        issues.push(issue('FLAGSHIP_TEACHING_MOMENT_INVALID', `Teaching moment ${index} must be an object`));
        return;
      }
      const id = rawMoment.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
        issues.push(issue('FLAGSHIP_TEACHING_MOMENT_INVALID', `Teaching moment ${index} has an invalid id`));
      } else if (momentIds.has(id)) {
        issues.push(issue('FLAGSHIP_TEACHING_DUPLICATE_ID', `Duplicate teaching moment ${id}`));
      } else {
        momentIds.add(id);
      }
      const stageId = rawMoment.stageId;
      const range = typeof stageId === 'string' ? stageRange(stages, stageId) : undefined;
      if (typeof stageId !== 'string' || !range) {
        issues.push(issue('FLAGSHIP_TEACHING_UNKNOWN_STAGE', `Teaching moment ${String(id)} refers to stage ${String(stageId)}`));
      } else if (!isFiniteNumber(rawMoment.at) || rawMoment.at < range.start - 0.0001 || rawMoment.at > range.end + 0.0001) {
        issues.push(issue('FLAGSHIP_TEACHING_OUTSIDE_STAGE', `Teaching moment ${String(id)} is outside stage ${stageId}`));
      }
      for (const key of ['question', 'hint', 'expectedObservation']) {
        if (!isBilingualText(rawMoment[key])) {
          issues.push(issue('FLAGSHIP_TEACHING_TEXT_INVALID', `Teaching moment ${String(id)} must have bilingual ${key}`));
        }
      }
    });
  }

  const evidence = scene.evidence;
  if (!Array.isArray(evidence) || evidence.length === 0) {
    issues.push(issue('FLAGSHIP_EVIDENCE_MISSING', 'Version 3 scene must contain evidence records'));
  } else {
    evidence.forEach((rawEvidence, index) => {
      if (!isRecord(rawEvidence)) {
        issues.push(issue('FLAGSHIP_EVIDENCE_INVALID', `Evidence ${index} must be an object`));
        return;
      }
      if (typeof rawEvidence.id !== 'string' || rawEvidence.id.trim().length === 0
        || typeof rawEvidence.label !== 'string' || rawEvidence.label.trim().length === 0) {
        issues.push(issue('FLAGSHIP_EVIDENCE_INVALID', `Evidence ${index} must have an id and label`));
      }
      if (typeof rawEvidence.url !== 'string' || rawEvidence.url.trim().length === 0) {
        issues.push(issue('FLAGSHIP_EVIDENCE_URL_MISSING', `Evidence ${String(rawEvidence.id)} must have a URL`));
      } else if (!rawEvidence.url.startsWith('https:')) {
        issues.push(issue('FLAGSHIP_EVIDENCE_URL_INVALID', `Evidence ${String(rawEvidence.id)} must use https`));
      }
    });
  }

  const review = scene.review;
  if (!isRecord(review)
    || typeof review.chemistryStatus !== 'string'
    || !FLAGSHIP_REVIEW_CHEMISTRY_STATUSES.has(review.chemistryStatus)
    || typeof review.teacherStatus !== 'string'
    || !FLAGSHIP_REVIEW_TEACHER_STATUSES.has(review.teacherStatus)) {
    issues.push(issue('FLAGSHIP_REVIEW_INVALID', 'Version 3 scene review statuses are invalid'));
    return;
  }
  if (review.chemistryStatus !== 'passed') {
    issues.push(issue('FLAGSHIP_CHEMISTRY_REVIEW_INCOMPLETE', 'Version 3 scene chemistry review must be passed'));
  }
  if (review.teacherStatus === 'reviewed') {
    const hasTeacherEvidence = Array.isArray(evidence) && evidence.some((rawEvidence) => (
      isRecord(rawEvidence)
      && typeof rawEvidence.id === 'string'
      && rawEvidence.id.startsWith('teacher-review-')
      && typeof rawEvidence.url === 'string'
      && rawEvidence.url.trim().length > 0
    ));
    if (!hasTeacherEvidence) {
      issues.push(issue('TEACHER_REVIEW_EVIDENCE_MISSING', 'Reviewed teacher status requires teacher-review evidence with a URL'));
    }
  }
}

function validateAnimationSceneRuntime(
  scene: unknown,
  reaction: CuratedReaction,
): ReactionAnimationAuditIssue[] {
  const issues: ReactionAnimationAuditIssue[] = [];
  if (!isRecord(scene)) return [issue('INVALID_SCENE_SHAPE', 'Reaction animation scene must be an object')];

  const version = scene.version;
  if (version !== 1 && version !== 2 && version !== 3) {
    issues.push(issue('INVALID_SCENE_VERSION', 'Scene version must be 1, 2 or 3'));
  }
  const isV2 = version === 2 || version === 3;
  const isV3 = version === 3;
  const familyValue = isV2 ? scene.primaryFamily : scene.family;
  if (typeof familyValue !== 'string' || !FAMILIES.has(familyValue)) {
    issues.push(issue('INVALID_SCENE_FAMILY', 'Scene family is invalid'));
  }
  if (typeof scene.environment !== 'string' || !ENVIRONMENTS.has(scene.environment)) {
    issues.push(issue('INVALID_SCENE_ENVIRONMENT', 'Scene environment is invalid'));
  }
  if (!isFiniteNumber(scene.duration) || scene.duration <= 0) {
    issues.push(issue('INVALID_DURATION', 'Scene duration must be a positive finite number'));
  }
  validateGateFields(scene, issues);

  const stageIds = new Set<string>();
  const stages = scene.stages;
  if (!Array.isArray(stages) || stages.length === 0) {
    issues.push(issue('MISSING_STAGES', 'Scene must contain at least one stage'));
  }
  if (Array.isArray(stages)) {
    stages.forEach((rawStage, index) => {
      if (!isRecord(rawStage)) {
        issues.push(issue('INVALID_STAGE_SHAPE', `Stage ${index} must be an object`));
        return;
      }
      const id = rawStage.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
        issues.push(issue('INVALID_STAGE_ID', `Stage ${index} has an invalid id`));
      } else if (stageIds.has(id)) {
        issues.push(issue('DUPLICATE_STAGE_ID', `Duplicate stage ${id}`));
      } else {
        stageIds.add(id);
      }
      if (!isFiniteNumber(rawStage.start) || !isFiniteNumber(rawStage.end)
        || rawStage.start < 0 || rawStage.end <= rawStage.start
        || (isFiniteNumber(scene.duration) && rawStage.end > scene.duration)) {
        issues.push(issue('INVALID_STAGE_RANGE', `Invalid range for stage ${String(id)}`));
      }
      const stepIndex = rawStage.stepIndex;
      if (!isFiniteNumber(stepIndex) || !Number.isInteger(stepIndex)
        || stepIndex < 0 || stepIndex >= reaction.mechanismSteps.length) {
        issues.push(issue('INVALID_STAGE_STEP', `Invalid step reference for stage ${String(id)}`));
      }
      if (!isBilingualText(rawStage.label) || !isBilingualText(rawStage.status)) {
        issues.push(issue('INVALID_STAGE_LABEL', `Stage ${String(id)} must have bilingual label and status`));
      }
      if (typeof rawStage.equationFocus !== 'string' || !FOCI.has(rawStage.equationFocus)) {
        issues.push(issue('INVALID_STAGE_FOCUS', `Invalid equation focus for stage ${String(id)}`));
      }
      if (index === 0 && isFiniteNumber(rawStage.start) && Math.abs(rawStage.start) > 0.0001) {
        issues.push(issue('STAGE_GAP', `Timeline starts at ${rawStage.start} instead of 0`));
      }
      const previous = stages[index - 1];
      if (index > 0 && isRecord(previous) && isFiniteNumber(previous.end) && isFiniteNumber(rawStage.start)
        && Math.abs(rawStage.start - previous.end) > 0.0001) {
        issues.push(issue('STAGE_GAP', `Gap or overlap before stage ${String(id)}`));
      }
      if (index === stages.length - 1 && isFiniteNumber(rawStage.end) && isFiniteNumber(scene.duration)
        && Math.abs(rawStage.end - scene.duration) > 0.0001) {
        issues.push(issue('STAGE_GAP', `Timeline ends at ${rawStage.end} instead of ${scene.duration}`));
      }
    });
  }

  const actorIds = new Set<string>();
  const actors = scene.actors;
  if (!Array.isArray(actors) || actors.length === 0) {
    issues.push(issue('MISSING_ACTORS', 'Scene must contain at least one actor'));
  }
  if (Array.isArray(actors)) {
    actors.forEach((rawActor, index) => {
      if (!isRecord(rawActor)) {
        issues.push(issue('INVALID_ACTOR_SHAPE', `Actor ${index} must be an object`));
        return;
      }
      const id = rawActor.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
        issues.push(issue('INVALID_ACTOR_ID', `Actor ${index} has an invalid id`));
      } else if (actorIds.has(id)) {
        issues.push(issue('DUPLICATE_ACTOR_ID', `Duplicate actor ${id}`));
      } else {
        actorIds.add(id);
      }
      if (typeof rawActor.kind !== 'string' || !ACTOR_KINDS.has(rawActor.kind)) {
        issues.push(issue('INVALID_ACTOR_KIND', `Actor ${String(id)} has an invalid kind`));
      }
      if (!isBilingualText(rawActor.label) || !isTuple3(rawActor.position)) {
        issues.push(issue('INVALID_ACTOR_SHAPE', `Actor ${String(id)} must have bilingual label and position`));
      }
      if (rawActor.target !== undefined && !isTuple3(rawActor.target)) {
        issues.push(issue('INVALID_ACTOR_TARGET', `Actor ${String(id)} has an invalid target`));
      }
      for (const key of ['element', 'formula', 'color']) {
        if (rawActor[key] !== undefined && (typeof rawActor[key] !== 'string' || rawActor[key].trim().length === 0)) {
          issues.push(issue('INVALID_ACTOR_FIELD', `Actor ${String(id)} has an invalid ${key}`));
        }
      }
      for (const key of ['charge', 'radius']) {
        if (rawActor[key] !== undefined && (!isFiniteNumber(rawActor[key]) || (key === 'radius' && rawActor[key] < 0))) {
          issues.push(issue('INVALID_ACTOR_FIELD', `Actor ${String(id)} has an invalid ${key}`));
        }
      }
    });
  }

  const effectIds = new Set<string>();
  const effects = scene.effects;
  if (isV2 && !Array.isArray(effects)) {
    issues.push(issue('MISSING_EFFECTS', 'Version 2 scene must contain effects'));
  }
  if (isV2 && Array.isArray(effects)) {
    effects.forEach((rawEffect, index) => {
      if (!isRecord(rawEffect)) {
        issues.push(issue('INVALID_EFFECT_SHAPE', `Effect ${index} must be an object`));
        return;
      }
      const id = rawEffect.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
        issues.push(issue('INVALID_EFFECT_ID', `Effect ${index} has an invalid id`));
      } else if (effectIds.has(id)) {
        issues.push(issue('DUPLICATE_EFFECT_ID', `Duplicate effect ${id}`));
      } else {
        effectIds.add(id);
      }
      if (typeof rawEffect.kind !== 'string' || !EFFECT_KINDS.has(rawEffect.kind)) {
        issues.push(issue('INVALID_EFFECT_KIND', `Effect ${String(id)} has an invalid kind`));
      }
      if (!isFiniteNumber(rawEffect.at) || !isFiniteNumber(rawEffect.duration)
        || rawEffect.at < 0 || rawEffect.duration <= 0
        || (isFiniteNumber(scene.duration) && rawEffect.at + rawEffect.duration > scene.duration + 0.0001)) {
        issues.push(issue('INVALID_EFFECT_RANGE', `Invalid timing for effect ${String(id)}`));
      }
      if (typeof rawEffect.easing !== 'string' || !EASINGS.has(rawEffect.easing)) {
        issues.push(issue('INVALID_EFFECT_EASING', `Effect ${String(id)} has an invalid easing`));
      }
      validateParams(rawEffect.params, `effect ${String(id)}.params`, issues);
    });
  }

  const eventIds = new Set<string>();
  const referencedEffects = new Set<string>();
  const effectToEvents = new Map<string, Array<{ at: number; end: number }>>();
  const events = scene.events;
  if (!Array.isArray(events) || events.length === 0) {
    issues.push(issue('MISSING_EVENTS', 'Scene must contain at least one event'));
  }
  if (Array.isArray(events)) {
    events.forEach((rawEvent, index) => {
      if (!isRecord(rawEvent)) {
        issues.push(issue('INVALID_EVENT_SHAPE', `Event ${index} must be an object`));
        return;
      }
      const id = rawEvent.id;
      if (typeof id !== 'string' || id.trim().length === 0) {
        issues.push(issue('INVALID_EVENT_ID', `Event ${index} has an invalid id`));
      } else if (eventIds.has(id)) {
        issues.push(issue('DUPLICATE_EVENT_ID', `Duplicate event ${id}`));
      } else {
        eventIds.add(id);
      }
      if (typeof rawEvent.kind !== 'string' || !EVENT_KINDS.has(rawEvent.kind)) {
        issues.push(issue('INVALID_EVENT_KIND', `Event ${String(id)} has an invalid kind`));
      }
      const stageId = rawEvent.stageId;
      if (typeof stageId !== 'string' || !stageIds.has(stageId)) {
        issues.push(issue('UNKNOWN_EVENT_STAGE', `Event ${String(id)} refers to stage ${String(stageId)}`));
      }
      if (!isBilingualText(rawEvent.label)) {
        issues.push(issue('INVALID_EVENT_LABEL', `Event ${String(id)} must have bilingual label`));
      }
      if (rawEvent.actorIds !== undefined) {
        if (!Array.isArray(rawEvent.actorIds) || rawEvent.actorIds.some((actorId) => typeof actorId !== 'string')) {
          issues.push(issue('INVALID_EVENT_ACTORS', `Event ${String(id)} actorIds must be string[]`));
        } else {
          rawEvent.actorIds.forEach((actorId) => {
            if (!actorIds.has(actorId)) issues.push(issue('UNKNOWN_EVENT_ACTOR', `Event ${String(id)} refers to actor ${actorId}`));
          });
        }
      }
      if (isV2 && (!Array.isArray(rawEvent.actorIds) || rawEvent.actorIds.length === 0)) {
        issues.push(issue('MISSING_EVENT_ACTORS', `Event ${String(id)} must reference actors`));
      }
      for (const key of ['fromActorId', 'toActorId']) {
        if (rawEvent[key] !== undefined && (typeof rawEvent[key] !== 'string' || !actorIds.has(rawEvent[key]))) {
          issues.push(issue('UNKNOWN_EVENT_ACTOR', `Event ${String(id)} refers to actor ${String(rawEvent[key])}`));
        }
      }

      let eventAt: number | undefined;
      let eventEnd: number | undefined;
      if (isV2) {
        if (!isFiniteNumber(rawEvent.at) || !isFiniteNumber(rawEvent.duration)
          || rawEvent.at < 0 || rawEvent.duration <= 0
          || (isFiniteNumber(scene.duration) && rawEvent.at + rawEvent.duration > scene.duration + 0.0001)) {
          issues.push(issue('INVALID_EVENT_RANGE', `Invalid timing for event ${String(id)}`));
        } else {
          eventAt = rawEvent.at;
          eventEnd = rawEvent.at + rawEvent.duration;
        }
        if (typeof rawEvent.easing !== 'string' || !EASINGS.has(rawEvent.easing)) {
          issues.push(issue('INVALID_EVENT_EASING', `Event ${String(id)} has an invalid easing`));
        }
        const validParams = validateParams(rawEvent.params, `event ${String(id)}.params`, issues);
        const params = validParams && isRecord(rawEvent.params) ? rawEvent.params : undefined;
        const effectRefs: string[] = [];
        if (params && Object.prototype.hasOwnProperty.call(params, 'effectId')) {
          const effectId = params.effectId;
          if (typeof effectId !== 'string') {
            issues.push(issue('INVALID_EVENT_EFFECT_REFERENCE', `Event ${String(id)} effectId must be a string`));
          } else {
            effectRefs.push(effectId);
          }
        }
        if (params && Object.prototype.hasOwnProperty.call(params, 'effectIds')) {
          const effectIdsValue = params.effectIds;
          if (!Array.isArray(effectIdsValue) || effectIdsValue.some((effectId) => typeof effectId !== 'string')) {
            issues.push(issue('INVALID_EVENT_EFFECT_REFERENCE', `Event ${String(id)} effectIds must be string[]`));
          } else {
            effectRefs.push(...effectIdsValue);
          }
        }
        if (effectRefs.length === 0) {
          issues.push(issue('MISSING_EVENT_EFFECT', `Event ${String(id)} must reference an effect`));
        }
        for (const effectId of new Set(effectRefs)) {
          referencedEffects.add(effectId);
          if (!effectIds.has(effectId)) {
            issues.push(issue('UNKNOWN_EVENT_EFFECT', `Event ${String(id)} refers to effect ${effectId}`));
          } else if (eventAt !== undefined && eventEnd !== undefined) {
            const ranges = effectToEvents.get(effectId) ?? [];
            ranges.push({ at: eventAt, end: eventEnd });
            effectToEvents.set(effectId, ranges);
          }
        }
      }

      if (isV2 && typeof stageId === 'string') {
        const stage = Array.isArray(stages)
          ? stages.find((candidate) => isRecord(candidate) && candidate.id === stageId)
          : undefined;
        if (isRecord(stage) && isFiniteNumber(stage.start) && isFiniteNumber(stage.end)
          && eventAt !== undefined && eventEnd !== undefined
          && (eventAt < stage.start - 0.0001 || eventEnd > stage.end + 0.0001)) {
          issues.push(issue('EVENT_OUTSIDE_STAGE', `Event ${String(id)} is outside stage ${stageId}`));
        }
      }
    });
  }

  if (isV2 && Array.isArray(effects)) {
    for (const rawEffect of effects) {
      if (!isRecord(rawEffect) || typeof rawEffect.id !== 'string') continue;
      if (!referencedEffects.has(rawEffect.id)) {
        issues.push(issue('UNREFERENCED_EFFECT', `Effect ${rawEffect.id} is not activated by any event`));
      }
      const ranges = effectToEvents.get(rawEffect.id);
      const effectAt = rawEffect.at;
      const effectDuration = rawEffect.duration;
      if (ranges && isFiniteNumber(effectAt) && isFiniteNumber(effectDuration)) {
        const overlaps = ranges.some((range) => effectAt < range.end + 0.0001
          && effectAt + effectDuration > range.at - 0.0001);
        if (!overlaps) issues.push(issue('EFFECT_EVENT_TIMING_MISMATCH', `Effect ${rawEffect.id} does not overlap its event`));
      }
    }
  }

  if (isV2 && Object.prototype.hasOwnProperty.call(scene, 'family')) {
    issues.push(issue('DEPRECATED_SCENE_FAMILY', 'Version 2 scene must use primaryFamily only'));
  }
  if (isV3 && Array.isArray(stages)) validateFlagshipRuntime(scene, stages, issues);
  return issues;
}

export function validateReactionAnimationScene(
  scene: ReactionAnimationScene,
  reaction: CuratedReaction,
): ReactionAnimationAuditIssue[] {
  return validateAnimationSceneRuntime(scene, reaction);
}

interface AtomRef {
  key: string;
  element: string;
  charge: number;
}

function structureAtoms(structure: MoleculeStructure | null): AtomRef[] {
  return structure?.atoms.map((atom) => ({
    key: String(atom.id),
    element: atom.element,
    charge: atom.charge ?? 0,
  })) ?? [];
}

function countElements(atoms: AtomRef[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const atom of atoms) counts[atom.element] = (counts[atom.element] ?? 0) + 1;
  return counts;
}

function auditReaction(
  reaction: CuratedReaction,
  profile: ReactionAnimationProfile | undefined,
): ReactionAnimationAuditEntry {
  const issues: ReactionAnimationAuditIssue[] = [];
  const flow = reaction.reactionFlow;
  const productStructure = reaction.productStructure;
  const equation = parseReactionEquation(reaction.equation);
  if (!equation.verifiable) {
    for (const detail of equation.issues) {
      issues.push(issue(
        'EQUATION_NOT_VERIFIABLE',
        `${reaction.id}: ${detail}`,
        equation.hardIssues.includes(detail) ? 'error' : 'warning',
      ));
    }
  }
  const equationConservation: ReactionAnimationAuditCheck = !equation.verifiable
    ? 'not-verifiable'
    : equation.balanced ? 'pass' : 'fail';
  if (equationConservation === 'fail') issues.push(issue('EQUATION_CONSERVATION_FAILED', 'Equation atom counts are not balanced'));

  if (!profile) issues.push(issue('MISSING_PROFILE', `No profile for ${reaction.id}`));
  const animationScene = reaction.reactionAnimation ?? createFallbackReactionAnimation(reaction, profile);
  if (animationScene) issues.push(...validateReactionAnimationScene(animationScene, reaction));

  if (!flow || !productStructure) {
    const profileGate = profile
      ? isReactionAnimationConservationEligible(profile as ReactionAnimationGateInput)
      : false;
    const qualityGate = profile && (profile.qualityLevel === 'L2' || profile.qualityLevel === 'L3')
      ? 'fail'
      : profile ? 'illustrative-only' : 'fail';
    if (qualityGate === 'fail') {
      issues.push(issue('QUALITY_REQUIRES_CONSERVATION', 'L2/L3 requires a complete reaction flow and product graph'));
    }
    if (profile && !profileGate && (profile.qualityLevel === 'L2' || profile.qualityLevel === 'L3')) {
      issues.push(issue('QUALITY_GATE_NOT_ELIGIBLE', 'Conservation eligibility requires L2/L3, non-illustrative, complete mapping review, and approved signoff'));
    }
    return {
      reactionId: reaction.id,
      declaredQuality: profile?.qualityLevel ?? 'missing',
      mappingStatus: 'missing',
      unmappedReactantAtoms: [],
      productIdBijection: 'not-verifiable',
      reactantStoichiometry: 'not-verifiable',
      productStoichiometry: 'not-verifiable',
      equationConservation,
      elementConservation: 'not-verifiable',
      chargeConservation: 'not-verifiable',
      qualityGate,
      issues,
    };
  }

  const reactantAtoms = new Map<string, AtomRef>();
  const flowAtomElements: AtomRef[] = [];
  flow.reactants.forEach((reactant, reactantIndex) => {
    const localIds = new Set<string>();
    for (const atom of structureAtoms(reactant.structure)) {
      const key = `${reactantIndex}:${atom.key}`;
      if (localIds.has(atom.key)) issues.push(issue('DUPLICATE_REACTANT_ATOM_ID', `Duplicate atom ${key}`));
      localIds.add(atom.key);
      const ref = { ...atom, key };
      reactantAtoms.set(key, ref);
      flowAtomElements.push(ref);
    }
  });
  const productAtoms = new Map<string, AtomRef>();
  for (const atom of structureAtoms(productStructure)) {
    if (productAtoms.has(atom.key)) issues.push(issue('DUPLICATE_PRODUCT_ATOM_ID', `Duplicate product atom ${atom.key}`));
    productAtoms.set(atom.key, atom);
  }

  const sourceKeys: string[] = [];
  const targetIds: string[] = [];
  let mappedElementsPass = true;
  if (!Array.isArray(flow.atomMap)) {
    issues.push(issue('INVALID_ATOM_MAP_SHAPE', 'reactionFlow.atomMap must be an array'));
  } else {
    flow.atomMap.forEach((mapping, index) => {
      if (!mapping || !Number.isInteger(mapping.reactant) || !Number.isInteger(mapping.atom) || !Number.isInteger(mapping.to)) {
        issues.push(issue('INVALID_ATOM_MAP_REFERENCE', `Invalid atomMap entry ${index}`));
        return;
      }
      const sourceKey = `${mapping.reactant}:${mapping.atom}`;
      const source = reactantAtoms.get(sourceKey);
      const target = productAtoms.get(String(mapping.to));
      if (!source || !target) {
        issues.push(issue('INVALID_ATOM_MAP_REFERENCE', `atomMap entry ${index} refers to a missing source or target`));
        return;
      }
      sourceKeys.push(sourceKey);
      targetIds.push(String(mapping.to));
      if (source.element !== target.element) {
        mappedElementsPass = false;
        issues.push(issue('ELEMENT_MAPPING_MISMATCH', `atomMap entry ${index} changes ${source.element} to ${target.element}`));
      }
    });
  }

  const duplicateSources = new Set(sourceKeys).size !== sourceKeys.length;
  const duplicateTargets = new Set(targetIds).size !== targetIds.length;
  if (duplicateSources) issues.push(issue('DUPLICATE_REACTANT_MAPPING', 'A reactant atom is mapped more than once'));
  if (duplicateTargets) issues.push(issue('DUPLICATE_PRODUCT_MAPPING', 'A product atom is mapped more than once'));
  const unmappedReactantAtoms = [...reactantAtoms.keys()].filter((key) => !sourceKeys.includes(key));
  const productIdBijection: ReactionAnimationAuditCheck = sourceKeys.length === 0
    ? 'fail'
    : !duplicateTargets && targetIds.length === productAtoms.size
      && [...productAtoms.keys()].every((id) => targetIds.includes(id))
      ? 'pass'
      : 'fail';

  const reactantStoichiometry: ReactionAnimationAuditCheck = !equation.verifiable
    ? 'not-verifiable'
    : countsEqual(countElements(flowAtomElements), equation.leftAtoms) ? 'pass' : 'fail';
  const productStoichiometry: ReactionAnimationAuditCheck = !equation.verifiable
    ? 'not-verifiable'
    : countsEqual(countElements([...productAtoms.values()]), equation.rightAtoms) ? 'pass' : 'fail';
  if (reactantStoichiometry === 'fail') {
    issues.push(issue('REACTANT_STOICHIOMETRY_MISMATCH', 'reactionFlow reactants do not cover every stoichiometric reactant term', 'warning'));
  }
  if (productStoichiometry === 'fail') {
    issues.push(issue('PRODUCT_STOICHIOMETRY_MISMATCH', 'productStructure does not cover every stoichiometric product term', 'warning'));
  }
  if (productIdBijection === 'fail') issues.push(issue('PRODUCT_ID_BIJECTION_FAILED', 'Product atom ids are not mapped exactly once'));
  if (unmappedReactantAtoms.length > 0) {
    issues.push(issue('UNMAPPED_REACTANT_ATOMS', `${unmappedReactantAtoms.length} reactant atoms are not mapped`, 'warning'));
  }

  const fullLocalMapping = unmappedReactantAtoms.length === 0
    && productIdBijection === 'pass'
    && !duplicateSources
    && !duplicateTargets
    && mappedElementsPass;
  const mappingStatus = fullLocalMapping && reactantStoichiometry === 'pass' && productStoichiometry === 'pass'
    ? 'complete'
    : 'incomplete';
  const fullConservationProof = mappingStatus === 'complete' && equationConservation === 'pass';
  const elementConservation: ReactionAnimationAuditCheck = !fullConservationProof
    ? 'not-verifiable'
    : mappedElementsPass ? 'pass' : 'fail';
  const reactantCharge = flowAtomElements.reduce((sum, atom) => sum + atom.charge, 0);
  const productCharge = [...productAtoms.values()].reduce((sum, atom) => sum + atom.charge, 0);
  const chargeConservation: ReactionAnimationAuditCheck = fullConservationProof && elementConservation === 'pass'
    ? reactantCharge === productCharge ? 'pass' : 'fail'
    : 'not-verifiable';
  if (elementConservation === 'fail') issues.push(issue('ELEMENT_CONSERVATION_FAILED', 'Mapped atom elements do not match'));
  if (chargeConservation === 'fail') issues.push(issue('CHARGE_CONSERVATION_FAILED', 'Total graph charge does not match'));

  const requiresConservation = profile?.qualityLevel === 'L2' || profile?.qualityLevel === 'L3';
  const profileGate = profile
    ? isReactionAnimationConservationEligible(profile as ReactionAnimationGateInput)
    : false;
  const sceneGate = animationScene
    ? isReactionAnimationConservationEligible(animationScene as ReactionAnimationGateInput)
    : true;
  if (profile && animationScene
    && (profile.qualityLevel !== animationScene.qualityLevel
      || profile.illustrativeOnly !== animationScene.illustrativeOnly
      || profile.mappingReview.status !== animationScene.mappingReview.status
      || profile.chemistrySignoff.status !== animationScene.chemistrySignoff.status)) {
    issues.push(issue('SCENE_PROFILE_GATE_MISMATCH', 'Scene and profile conservation gate fields must agree'));
  }

  let qualityGate: ReactionAnimationAuditEntry['qualityGate'];
  if (requiresConservation) {
    const conservationPassed = fullConservationProof && elementConservation === 'pass'
      && chargeConservation === 'pass' && profileGate && sceneGate;
    qualityGate = conservationPassed ? 'pass' : 'fail';
    if (!conservationPassed) {
      issues.push(issue('QUALITY_REQUIRES_CONSERVATION', 'L2/L3 requires complete equation coverage, conservation, and the shared approved gate'));
    }
  } else {
    qualityGate = profile ? 'illustrative-only' : 'fail';
    if (profile && !profile.illustrativeOnly) {
      qualityGate = 'fail';
      issues.push(issue('LOW_QUALITY_MUST_BE_ILLUSTRATIVE', 'L0/L1 profiles must remain illustrative-only'));
    }
  }

  return {
    reactionId: reaction.id,
    declaredQuality: profile?.qualityLevel ?? 'missing',
    mappingStatus,
    unmappedReactantAtoms,
    productIdBijection,
    reactantStoichiometry,
    productStoichiometry,
    equationConservation,
    elementConservation,
    chargeConservation,
    qualityGate,
    issues,
  };
}

export function compileReactionAnimationAudit(
  reactions: CuratedReaction[],
  profiles: ReactionAnimationProfile[],
): ReactionAnimationAuditReport {
  const validatedProfiles = parseAnimationProfiles(profiles as unknown);
  const reactionIds = new Set(reactions.map((reaction) => reaction.id));
  const profileIds = validatedProfiles.map((profile) => profile.reactionId);
  const manifestIssues: ReactionAnimationAuditIssue[] = [];
  for (const reaction of reactions) {
    if (!profileIds.includes(reaction.id)) manifestIssues.push(issue('MISSING_PROFILE', `No profile for ${reaction.id}`));
  }
  for (const profile of validatedProfiles) {
    if (!reactionIds.has(profile.reactionId)) manifestIssues.push(issue('UNKNOWN_PROFILE', `Profile ${profile.reactionId} has no formal reaction`));
    if (profile.effects.length === 0) manifestIssues.push(issue('MISSING_EFFECTS', `Profile ${profile.reactionId} has no effects`));
    if (profile.stateCues.length === 0 || profile.phenomena.length === 0) {
      manifestIssues.push(issue('MISSING_PHENOMENON_HINTS', `Profile ${profile.reactionId} lacks state or phenomenon hints`));
    }
  }

  const profileById = new Map(validatedProfiles.map((profile) => [profile.reactionId, profile]));
  const entries = reactions.map((reaction) => auditReaction(reaction, profileById.get(reaction.id)));
  return {
    schemaVersion: 'reaction-animation-audit.v1',
    generatedAt: new Date().toISOString(),
    summary: {
      reactions: reactions.length,
      profiles: validatedProfiles.length,
      flows: entries.filter((entry) => entry.mappingStatus !== 'missing').length,
      completeMappings: entries.filter((entry) => entry.mappingStatus === 'complete').length,
      incompleteMappings: entries.filter((entry) => entry.mappingStatus === 'incomplete').length,
      missingFlows: entries.filter((entry) => entry.mappingStatus === 'missing').length,
      qualityGateFailures: entries.filter((entry) => entry.qualityGate === 'fail').length,
    },
    entries,
    manifestIssues,
  };
}

export function hasBlockingReactionAnimationAuditIssues(report: ReactionAnimationAuditReport): boolean {
  return report.manifestIssues.some((entry) => entry.severity === 'error')
    || report.entries.some((entry) => entry.issues.some((entryIssue) => entryIssue.severity === 'error'))
    || report.summary.qualityGateFailures > 0;
}
