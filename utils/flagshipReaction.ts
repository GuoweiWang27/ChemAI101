import type {
  CuratedReaction,
  FlagshipTrackEvent,
  ReactionAnimationEffect,
  ReactionAnimationEffectKind,
  ReactionAnimationEventKind,
  ReactionAnimationScene,
  ReactionAnimationSceneV3,
  ReactionAnimationStage,
} from '../src/data/reactions/schema';
import {
  FLAGSHIP_REACTION_IDS,
  getFlagshipBlueprint,
  type FlagshipBlueprint,
} from '../src/data/reactions/flagshipScenes.ts';
import { getAnimationProfile } from '../src/data/reactions/animationProfiles.ts';
import { createFallbackReactionAnimation } from './reactionAnimation.ts';

const FLAGSHIP_STAGE_DURATION = 3;

export function isFlagshipReactionScene(
  scene: ReactionAnimationScene | undefined,
): scene is ReactionAnimationSceneV3 {
  return scene?.version === 3;
}

function eventKindForEffect(kind: ReactionAnimationEffectKind): ReactionAnimationEventKind {
  if (kind === 'heat-glow') return 'heat';
  if (kind === 'gas-bubbles' || kind === 'particle-smoke') return 'gas-bubble';
  if (kind === 'precipitate-cloud') return 'precipitate';
  if (kind === 'solution-color') return 'color-change';
  if (kind === 'electron-path') return 'electron-transfer';
  if (kind === 'ion-field') return 'ionize';
  if (kind === 'bond-rewire') return 'bond-form';
  return 'observe';
}

function trackParams(values: Record<string, string | number | boolean>): FlagshipTrackEvent['params'] {
  return values;
}

function macroParams(
  blueprint: FlagshipBlueprint,
  stage: ReactionAnimationStage,
  stageIndex: number,
): FlagshipTrackEvent['params'] {
  const params: Record<string, string | number | boolean> = {
    educationalAbstraction: true,
  };

  if (blueprint.reactionId === 'na-h2o') {
    if (blueprint.macroKinds[stageIndex] === 'metal-on-water') {
      params.mayIgnite = stageIndex >= 3;
      params.motionCue = stageIndex === 0 ? 'float' : 'move';
    }
    if (blueprint.macroKinds[stageIndex] === 'heat-rise') params.cue = '放热';
    if (blueprint.macroKinds[stageIndex] === 'solution-color') {
      params.from = '#bdeaf2';
      params.to = '#ff597b';
      params.fromLabel = 'clear';
      params.toLabel = 'pink';
    }
  }

  if (blueprint.reactionId === 's-o2') {
    if (blueprint.macroKinds[stageIndex] === 'heat-rise') params.cue = '加热';
    if (blueprint.macroKinds[stageIndex] === 'flame') {
      params.color = '#4aa8ff';
      params.secondaryColor = '#7f8cff';
      params.flameLabel = '蓝色至蓝紫色火焰';
    }
    if (blueprint.macroKinds[stageIndex] === 'smoke') {
      params.color = '#dfe8e7';
      params.mode = 'diffusion';
    }
  }

  if (blueprint.reactionId === 'nh3-hcl-smoke') {
    params.color = '#f4f1ea';
    params.mode = stageIndex === 0 ? 'opposing-gases' : 'white-particles';
  }

  if (blueprint.reactionId === 'c2h4-br2') {
    params.from = '#9f3e2e';
    params.to = '#e8e8df';
    params.fromLabel = '红棕色';
    params.toLabel = '无色';
    params.medium = 'non-aqueous-inert';
    params.conditionNote = '教材化非水加成模型；含水体系可能形成卤代醇';
    params.cumulativeAcrossStages = true;
  }

  if (blueprint.reactionId === 'cao-water-exothermic') {
    if (blueprint.macroKinds[stageIndex] === 'heat-rise') params.cue = '温度上升';
    if (blueprint.macroKinds[stageIndex] === 'solid-hydration') {
      params.fromColor = '#f4f0e8';
      params.toColor = '#fffdf6';
      params.morphology = stageIndex === 0 ? 'solid-fragments' : 'hydrated-expansion';
    }
  }

  return trackParams({
    ...params,
    stageId: stage.id,
    stageIndex,
    stageCount: blueprint.stageLabels.length,
  });
}

function dedupeEvidence(
  blueprint: FlagshipBlueprint,
  profileEvidence: ReactionAnimationSceneV3['evidence'] | undefined,
): ReactionAnimationSceneV3['evidence'] {
  const byId = new Map<string, ReactionAnimationSceneV3['evidence'][number]>();
  for (const record of [...blueprint.evidence, ...(profileEvidence ?? [])]) {
    if (record.url) byId.set(record.id, record);
  }
  return [...byId.values()];
}

function pickActorIds(
  actors: ReactionAnimationSceneV3['actors'],
  stageIndex: number,
  stageCount: number,
): string[] {
  if (actors.length === 0) return [];
  const initial = actors.filter((actor) => actor.id.startsWith('reactant-') || actor.id === 'water' || actor.id === 'sodium-bead');
  const products = actors.filter((actor) => actor.id.startsWith('product-atom-')
    || actor.id.startsWith('na-plus-')
    || actor.id.startsWith('oh-minus-')
    || actor.id === 'h2-gas');
  const candidates = stageIndex === 0
    ? initial
    : stageIndex === stageCount - 1
      ? products
      : actors.filter((actor) => actor.kind !== 'water-surface');
  return (candidates.length > 0 ? candidates : actors).slice(0, 8).map((actor) => actor.id);
}

function buildStages(reaction: CuratedReaction, blueprint: FlagshipBlueprint): ReactionAnimationStage[] {
  return blueprint.stageLabels.map((stage, index) => ({
    id: stage.id,
    start: index * FLAGSHIP_STAGE_DURATION,
    end: (index + 1) * FLAGSHIP_STAGE_DURATION,
    stepIndex: Math.min(index, Math.max(0, reaction.mechanismSteps.length - 1)),
    label: { zh: stage.labelZh, en: stage.labelEn },
    status: { zh: stage.statusZh, en: stage.statusEn },
    equationFocus: stage.equationFocus,
  }));
}

function buildEffects(
  reaction: CuratedReaction,
  blueprint: FlagshipBlueprint,
  stages: ReactionAnimationStage[],
): ReactionAnimationEffect[] {
  const profile = getAnimationProfile(reaction.id);
  const profileEffects = profile?.effects ?? [{ kind: 'particle-smoke' as const, params: {} }];
  return stages.map((stage, index) => {
    const source = profileEffects[index % profileEffects.length];
    return {
      id: `${reaction.id}-flagship-effect-${index + 1}`,
      kind: source.kind,
      at: stage.start,
      duration: stage.end - stage.start,
      easing: 'ease-in-out',
      params: {
        ...source.params,
        stageId: stage.id,
        flagshipMacro: blueprint.macroKinds[index],
      },
    };
  });
}

function buildEvents(
  reaction: CuratedReaction,
  stages: ReactionAnimationStage[],
  actors: ReactionAnimationSceneV3['actors'],
  effects: ReactionAnimationEffect[],
): ReactionAnimationSceneV3['events'] {
  return stages.map((stage, index) => ({
    id: `${reaction.id}-flagship-event-${index + 1}`,
    kind: eventKindForEffect(effects[index].kind),
    stageId: stage.id,
    at: stage.start,
    duration: stage.end - stage.start,
    easing: 'ease-in-out',
    params: {
      effectId: effects[index].id,
      stateCues: getAnimationProfile(reaction.id)?.stateCues ?? [],
      phenomena: getAnimationProfile(reaction.id)?.phenomena ?? [],
    },
    actorIds: pickActorIds(actors, index, stages.length),
    label: stage.label,
  }));
}

function buildTrackEvents(
  reaction: CuratedReaction,
  blueprint: FlagshipBlueprint,
  stages: ReactionAnimationStage[],
): Pick<ReactionAnimationSceneV3, 'macroTrack' | 'microTrack' | 'equationTrack'> {
  const macroTrack = stages.map((stage, index) => ({
    id: `${reaction.id}-macro-${index + 1}`,
    stageId: stage.id,
    at: stage.start,
    duration: stage.end - stage.start,
    label: stage.label,
    kind: blueprint.macroKinds[index],
    params: macroParams(blueprint, stage, index),
  }));
  const microTrack = stages.map((stage, index) => ({
    id: `${reaction.id}-micro-${index + 1}`,
    stageId: stage.id,
    at: stage.start,
    duration: stage.end - stage.start,
    label: stage.label,
    kind: blueprint.microKinds[index],
    params: trackParams({ stageIndex: index }),
  }));
  const equationTrack = stages.map((stage, index) => ({
    id: `${reaction.id}-equation-${index + 1}`,
    stageId: stage.id,
    at: stage.start,
    duration: stage.end - stage.start,
    label: stage.label,
    kind: stage.equationFocus,
    params: trackParams({ stageIndex: index }),
  }));
  return { macroTrack, microTrack, equationTrack };
}

function buildTeachingMoments(
  blueprint: FlagshipBlueprint,
  stages: ReactionAnimationStage[],
): ReactionAnimationSceneV3['teachingMoments'] {
  const stageIndexes = [1, 2, stages.length - 1];
  return blueprint.teachingMoments.map((moment, index) => {
    const stage = stages[stageIndexes[index] ?? stages.length - 1];
    return {
      ...moment,
      stageId: stage.id,
      at: stage.start + (stage.end - stage.start) * 0.62,
    };
  });
}

export function createFlagshipReactionAnimation(
  reaction: CuratedReaction,
): ReactionAnimationSceneV3 | null {
  const blueprint = getFlagshipBlueprint(reaction.id);
  if (!blueprint) return null;
  if (!reaction.reactionFlow) {
    throw new Error(`Cannot create flagship scene for ${reaction.id}: reactionFlow is required`);
  }
  if (!reaction.productStructure) {
    throw new Error(`Cannot create flagship scene for ${reaction.id}: productStructure is required`);
  }

  const profile = getAnimationProfile(reaction.id);
  const fallback = createFallbackReactionAnimation(reaction, profile);
  if (!fallback) {
    throw new Error(`Cannot create flagship scene for ${reaction.id}: fallback scene could not be created`);
  }
  const embedded = reaction.reactionAnimation;
  const actors = reaction.id === 'na-h2o' && embedded?.version === 1
    ? embedded.actors
    : fallback.actors;
  const stages = buildStages(reaction, blueprint);
  const effects = buildEffects(reaction, blueprint, stages);
  const events = buildEvents(reaction, stages, actors, effects);
  const tracks = buildTrackEvents(reaction, blueprint, stages);

  return {
    version: 3,
    primaryFamily: fallback.primaryFamily,
    environment: fallback.environment,
    duration: stages[stages.length - 1].end,
    illustrativeOnly: profile?.illustrativeOnly ?? false,
    qualityLevel: blueprint.qualityLevel,
    mappingReview: profile?.mappingReview ?? { status: 'complete', note: 'Flagship blueprint review' },
    chemistrySignoff: profile?.chemistrySignoff ?? { status: 'approved', note: 'Project chemistry review' },
    effects,
    stages,
    actors,
    events,
    productGraphs: fallback.productGraphs,
    assetRef: fallback.assetRef,
    evidence: dedupeEvidence(blueprint, profile?.evidence),
    macroTrack: tracks.macroTrack,
    microTrack: tracks.microTrack,
    equationTrack: tracks.equationTrack,
    teachingMoments: buildTeachingMoments(blueprint, stages),
    cameraShots: blueprint.cameraShots,
    review: {
      chemistryStatus: 'passed',
      teacherStatus: 'pending',
    },
  };
}

export function safelyCreateFlagshipReactionAnimation(
  reaction: CuratedReaction,
): ReactionAnimationSceneV3 | null {
  try {
    return createFlagshipReactionAnimation(reaction);
  } catch {
    return null;
  }
}

export function getFlagshipStageReplayRange(
  scene: ReactionAnimationSceneV3,
  stageId: string,
): { start: number; end: number } | null {
  const stage = scene.stages.find((candidate) => candidate.id === stageId);
  return stage ? { start: stage.start, end: stage.end } : null;
}

export function getFlagshipStageReplayStopTime(
  scene: ReactionAnimationSceneV3,
  stageId: string,
): number | null {
  const range = getFlagshipStageReplayRange(scene, stageId);
  if (!range) return null;
  return Math.max(range.start, range.end - 0.001);
}

export function advanceFlagshipPlayback(
  currentTime: number,
  elapsedSeconds: number,
  speed: number,
  playbackEnd: number,
): number {
  const safeCurrent = Number.isFinite(currentTime) ? currentTime : 0;
  const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  const safeSpeed = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const safeEnd = Number.isFinite(playbackEnd) ? Math.max(0, playbackEnd) : safeCurrent;
  return Math.min(safeEnd, safeCurrent + safeElapsed * safeSpeed);
}

export function resolvePlaybackEndOnResume(
  currentTime: number,
  currentPlaybackEnd: number,
  sceneDuration: number,
): number {
  const reachedLocalEnd = currentPlaybackEnd < sceneDuration
    && currentTime >= currentPlaybackEnd - 0.0001;
  return reachedLocalEnd ? sceneDuration : currentPlaybackEnd;
}

export { FLAGSHIP_REACTION_IDS };
