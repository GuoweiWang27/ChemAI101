import { describe, expect, it } from 'vitest';
import { ALL_REACTIONS, getReaction } from '../src/data/reactions';
import { FLAGSHIP_REACTION_IDS } from '../src/data/reactions/flagshipScenes';
import {
  advanceFlagshipPlayback,
  getFlagshipStageReplayRange,
  getFlagshipStageReplayStopTime,
  isFlagshipReactionScene,
  resolvePlaybackEndOnResume,
} from './flagshipReaction';
import { getAnimationSnapshot } from './reactionAnimation';
import { shouldUseSodiumWaterScene } from '../components/ReactionFlowScene';
import { FLAGSHIP_BLUEPRINTS, FLAGSHIP_MICRO_KINDS } from '../src/data/reactions/flagshipScenes';

describe('flagship reaction scene v3', () => {
  it('publishes exactly the five approved classroom flagships', () => {
    expect(FLAGSHIP_REACTION_IDS).toEqual([
      'na-h2o',
      's-o2',
      'nh3-hcl-smoke',
      'c2h4-br2',
      'cao-water-exothermic',
    ]);
    expect(ALL_REACTIONS.filter((reaction) => isFlagshipReactionScene(reaction.reactionAnimation)))
      .toHaveLength(5);
  });

  it('keeps every declared flagship micro kind inside the audited renderer registry', () => {
    const supported = new Set<string>(FLAGSHIP_MICRO_KINDS);
    const declared = Object.values(FLAGSHIP_BLUEPRINTS).flatMap((blueprint) => blueprint.microKinds);
    expect(declared.every((kind) => supported.has(kind))).toBe(true);
    expect(new Set(declared)).toEqual(supported);
  });

  it.each(FLAGSHIP_REACTION_IDS)('%s has classroom tracks and pending teacher review', (reactionId) => {
    const scene = getReaction(reactionId)?.reactionAnimation;
    expect(scene?.version).toBe(3);
    if (!isFlagshipReactionScene(scene)) throw new Error(`${reactionId} missing v3 scene`);
    expect(scene.stages.length).toBeGreaterThanOrEqual(4);
    expect(scene.teachingMoments.length).toBeGreaterThanOrEqual(3);
    expect(scene.macroTrack.length).toBeGreaterThanOrEqual(scene.stages.length);
    expect(scene.microTrack.length).toBeGreaterThanOrEqual(scene.stages.length);
    expect(scene.equationTrack.length).toBeGreaterThanOrEqual(scene.stages.length);
    expect(scene.review.chemistryStatus).toBe('passed');
    expect(scene.review.teacherStatus).toBe('pending');
    expect(scene.evidence.length).toBeGreaterThan(0);
  });

  it('keeps replay ranges local and activates only the next stage at a boundary', () => {
    const scene = getReaction('s-o2')?.reactionAnimation;
    if (!isFlagshipReactionScene(scene)) throw new Error('s-o2 flagship scene missing');
    const first = scene.stages[0];
    const middle = scene.stages[Math.floor(scene.stages.length / 2)];
    const last = scene.stages[scene.stages.length - 1];
    expect(getFlagshipStageReplayRange(scene, first.id)).toEqual({ start: first.start, end: first.end });
    expect(getFlagshipStageReplayRange(scene, middle.id)).toEqual({ start: middle.start, end: middle.end });
    expect(getFlagshipStageReplayRange(scene, last.id)).toEqual({ start: last.start, end: last.end });
    expect(getFlagshipStageReplayRange(scene, 'unknown-stage')).toBeNull();
    expect(getAnimationSnapshot(scene, first.end).stage.id).toBe(scene.stages[1].id);
    const replayStop = getFlagshipStageReplayStopTime(scene, first.id)!;
    expect(advanceFlagshipPlayback(first.start, 99, 1.5, replayStop)).toBe(replayStop);
    expect(getAnimationSnapshot(scene, replayStop).stage.id).toBe(first.id);
    expect(getFlagshipStageReplayStopTime(scene, 'unknown-stage')).toBeNull();
    expect(advanceFlagshipPlayback(first.start, 1, 0.5, first.end)).toBe(first.start + 0.5);
    expect(resolvePlaybackEndOnResume(first.start + 1, replayStop, scene.duration)).toBe(replayStop);
    expect(resolvePlaybackEndOnResume(replayStop, replayStop, scene.duration)).toBe(scene.duration);
  });

  it('keeps the dedicated sodium-water micro renderer for the V3 flagship', () => {
    const sodiumScene = getReaction('na-h2o')?.reactionAnimation;
    const sulfurScene = getReaction('s-o2')?.reactionAnimation;
    expect(sodiumScene?.version).toBe(3);
    expect(shouldUseSodiumWaterScene(sodiumScene)).toBe(true);
    expect(shouldUseSodiumWaterScene(sulfurScene)).toBe(false);
    if (!isFlagshipReactionScene(sodiumScene)) throw new Error('na-h2o flagship scene missing');
    expect(sodiumScene.stages.map((stage) => stage.id)).toEqual([
      'surface',
      'melt',
      'electron',
      'hydrogen',
      'ions',
    ]);
    expect(sodiumScene.teachingMoments.map((moment) => moment.stageId)).toEqual([
      'surface',
      'hydrogen',
      'ions',
    ]);
  });

  it.each([
    ['s-o2', ['sulfur-heating', 'sulfur-oxygen-bonding', 'sulfur-ignition']],
    ['nh3-hcl-smoke', ['ammonium-chloride-particles', 'diffusion-meeting', 'proton-transfer']],
    ['c2h4-br2', ['bromine-color-loss', 'bond-rearrangement', 'addition-product']],
    ['cao-water-exothermic', ['heat-release', 'hydroxide-formation', 'slaked-lime-formation']],
  ] as const)('%s binds each teaching prompt to its semantic stage', (reactionId, stageIds) => {
    const scene = getReaction(reactionId)?.reactionAnimation;
    if (!isFlagshipReactionScene(scene)) throw new Error(`${reactionId} flagship scene missing`);
    expect(scene.teachingMoments.map((moment) => moment.stageId)).toEqual(stageIds);
  });
});
