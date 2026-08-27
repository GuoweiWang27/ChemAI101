import { describe, expect, it } from 'vitest';
import { getReaction } from '../src/data/reactions';
import type { ReactionAnimationSceneV2 } from '../src/data/reactions/schema';
import { createFallbackReactionAnimation } from './reactionAnimation';
import {
  buildReactionVisualDirectives,
  canRenderAtomConservation,
} from './reactionAnimationVisuals';

describe('declarative reaction visual dispatcher', () => {
  it.each([
    ['s-o2', 'heat'],
    ['nh3-fountain', 'bubbles'],
    ['glucose-cuoh2', 'precipitate'],
    ['nh3-hcl-smoke', 'ion-field'],
    ['c2h4-br2', 'bond-rewire'],
  ] as const)('dispatches %s to the reusable %s renderer', (reactionId, renderer) => {
    const scene = createFallbackReactionAnimation(getReaction(reactionId)!)!;
    const effect = scene.effects.find((candidate) => candidate.kind === (
      renderer === 'heat' ? 'heat-glow'
        : renderer === 'bubbles' ? 'gas-bubbles'
          : renderer === 'precipitate' ? 'precipitate-cloud'
            : renderer === 'ion-field' ? 'ion-field'
              : 'bond-rewire'
    ));
    const event = scene.events.find((candidate) => {
      const refs = [candidate.params.effectId, ...(Array.isArray(candidate.params.effectIds) ? candidate.params.effectIds : [])];
      return effect ? refs.includes(effect.id) : false;
    })!;
    const directives = buildReactionVisualDirectives(scene, event.at + event.duration / 2);

    expect(directives).toEqual(
      expect.arrayContaining([expect.objectContaining({ renderer })]),
    );
  });

  it('passes profile params and event progress through instead of substituting family colors', () => {
    const scene = createFallbackReactionAnimation(getReaction('c2h4-br2')!)!;
    const effect = scene.effects.find((candidate) => candidate.kind === 'solution-color')!;
    const event = scene.events.find((candidate) => candidate.params.effectId === effect.id)!;
    const directive = buildReactionVisualDirectives(scene, event.at + event.duration / 2)
      .find((candidate) => candidate.renderer === 'solution-color');

    expect(directive).toMatchObject({
      params: { from: '#9f3e2e', to: '#e8e8df' },
      progress: expect.any(Number),
      activeEventIds: expect.any(Array),
    });
  });

  it('blocks atom-conservation rendering unless the v2 quality gate is explicit', () => {
    const illustrative = createFallbackReactionAnimation(getReaction('c2h4-br2')!)!;
    const approved = {
      ...illustrative,
      illustrativeOnly: false,
      qualityLevel: 'L2',
      mappingReview: { status: 'complete' },
      chemistrySignoff: { status: 'approved' },
    } satisfies ReactionAnimationSceneV2;

    expect(canRenderAtomConservation(illustrative)).toBe(false);
    expect(canRenderAtomConservation(approved)).toBe(true);
    expect(canRenderAtomConservation(getReaction('na-h2o')!.reactionAnimation!)).toBe(true);
  });
});
