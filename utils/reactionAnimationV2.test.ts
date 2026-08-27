import { describe, expect, it } from 'vitest';
import { ALL_REACTIONS, getReaction } from '../src/data/reactions';
import {
  ANIMATION_PROFILES,
  getAnimationProfile,
  parseAnimationProfiles,
} from '../src/data/reactions/animationProfiles';
import type { CuratedReaction, ReactionAnimationSceneV2 } from '../src/data/reactions/schema';
import {
  createFallbackReactionAnimation,
  getActiveAnimationEvents,
  getActiveAnimationEffects,
  getAnimationPrimaryFamily,
  inferReactionAnimationFamily,
} from './reactionAnimation';
import { isFlagshipReactionScene } from './flagshipReaction';

describe('reaction animation schema v2 and explicit profiles', () => {
  it('covers every formal reaction exactly once with an explicit profile', () => {
    const reactionIds = ALL_REACTIONS.map((reaction) => reaction.id).sort();
    const profileIds = ANIMATION_PROFILES.map((profile) => profile.reactionId).sort();

    expect(ANIMATION_PROFILES).toHaveLength(40);
    expect(new Set(profileIds).size).toBe(profileIds.length);
    expect(profileIds).toEqual(reactionIds);
  });

  it('uses profile authority rather than title or id regular expressions', () => {
    const disguised = {
      ...getReaction('s-o2')!,
      id: 'unknown-reaction',
      title: '燃烧并放出气体的有机反应',
      reactionAnimation: undefined,
    } satisfies CuratedReaction;

    expect(getAnimationProfile(disguised.id)).toBeUndefined();
    expect(inferReactionAnimationFamily(disguised)).toBe('generic');
  });

  it('declares five reusable families and composable phenomenon effects', () => {
    expect(getAnimationProfile('s-o2')).toMatchObject({
      primaryFamily: 'combustion',
      effects: expect.arrayContaining([expect.objectContaining({ kind: 'heat-glow' })]),
    });
    expect(getAnimationProfile('nh3-fountain')).toMatchObject({
      primaryFamily: 'gas-evolution',
      effects: expect.arrayContaining([expect.objectContaining({ kind: 'gas-bubbles' })]),
    });
    expect(getAnimationProfile('glucose-cuoh2')).toMatchObject({
      primaryFamily: 'precipitation-color',
      effects: expect.arrayContaining([expect.objectContaining({ kind: 'precipitate-cloud' })]),
    });
    expect(getAnimationProfile('nh3-hcl-smoke')).toMatchObject({
      primaryFamily: 'ionic',
      effects: expect.arrayContaining([expect.objectContaining({ kind: 'ion-field' })]),
    });
    expect(getAnimationProfile('c2h4-br2')).toMatchObject({
      primaryFamily: 'organic-bond',
      effects: expect.arrayContaining([expect.objectContaining({ kind: 'bond-rewire' })]),
    });
  });

  it('keeps the sodium v1 actors in the v3 overlay and compiles legacy flows to v2 scenes', () => {
    const sodium = getReaction('na-h2o')!;
    const sulfur = getReaction('s-o2')!;
    const sodiumScene = sodium.reactionAnimation!;
    const fallback = createFallbackReactionAnimation(sulfur);

    expect(sodiumScene.version).toBe(3);
    expect(isFlagshipReactionScene(sodiumScene)).toBe(true);
    expect(sodiumScene.actors.some((actor) => actor.id === 'sodium-bead')).toBe(true);
    expect(getAnimationPrimaryFamily(sodiumScene)).toBe('ionic');
    expect(fallback).toMatchObject({
      version: 2,
      primaryFamily: 'combustion',
      illustrativeOnly: false,
      qualityLevel: 'L2',
      chemistrySignoff: { status: 'approved' },
    });
  });

  it('publishes exactly five v3 scenes while leaving non-flagship scenes on the fallback path', () => {
    const flagshipScenes = ALL_REACTIONS.filter((reaction) => isFlagshipReactionScene(reaction.reactionAnimation));
    expect(flagshipScenes.map((reaction) => reaction.id).sort()).toEqual([
      'c2h4-br2', 'cao-water-exothermic', 'na-h2o', 'nh3-hcl-smoke', 's-o2',
    ]);
    expect(getReaction('c2h4-hydration')?.reactionAnimation).toBeUndefined();
  });

  it('dispatches v2 events and effects from their own timing and params', () => {
    const scene = createFallbackReactionAnimation(getReaction('c2h4-br2')!) as ReactionAnimationSceneV2;
    const event = scene.events[1];
    const effect = scene.effects.find((candidate) => candidate.kind === 'bond-rewire')!;
    const eventTime = event.at + event.duration / 2;
    const effectTime = effect.at + effect.duration / 2;

    expect(getActiveAnimationEvents(scene, eventTime)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: event.id, params: expect.any(Object) })]),
    );
    expect(getActiveAnimationEvents(scene, event.at + event.duration + 0.001)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: event.id })]),
    );
    expect(getActiveAnimationEffects(scene, effectTime)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: effect.id, progress: expect.any(Number) })]),
    );
    expect(scene.actors.length).toBeGreaterThan(0);
    for (const sceneEvent of scene.events) {
      expect(sceneEvent.actorIds?.length).toBeGreaterThan(0);
      const effectRefs = [
        sceneEvent.params.effectId,
        ...(Array.isArray(sceneEvent.params.effectIds) ? sceneEvent.params.effectIds : []),
      ].filter((value): value is string => typeof value === 'string');
      expect(effectRefs.length).toBeGreaterThan(0);
      for (const effectId of effectRefs) {
        expect(scene.effects.some((candidate) => candidate.id === effectId)).toBe(true);
      }
    }
  });

  it('activates an effect only through an active event reference', () => {
    const scene = createFallbackReactionAnimation(getReaction('c2h4-br2')!) as ReactionAnimationSceneV2;
    const effect = scene.effects.find((candidate) => candidate.at > 0)!;
    const event = scene.events.find((candidate) => {
      const refs = [
        candidate.params.effectId,
        ...(Array.isArray(candidate.params.effectIds) ? candidate.params.effectIds : []),
      ];
      return refs.includes(effect.id);
    })!;

    expect(getActiveAnimationEffects(scene, event.at - 0.01)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: effect.id })]),
    );
    expect(getActiveAnimationEffects(scene, event.at)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: effect.id })]),
    );
  });

  it('rejects malformed profile enums and nested parameter shapes at runtime', () => {
    const valid = ANIMATION_PROFILES[0];
    expect(() => parseAnimationProfiles([{
      ...valid,
      primaryFamily: 'not-a-family',
    }])).toThrow(/primaryFamily/);
    expect(() => parseAnimationProfiles([{
      ...valid,
      effects: [{ ...valid.effects[0], params: { invalid: { nested: true } } }],
    }])).toThrow(/effects\[0\]\.params/);
  });
});
