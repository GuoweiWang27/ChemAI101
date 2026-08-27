import { describe, expect, it } from 'vitest';
import { ALL_REACTIONS, getReaction } from '../src/data/reactions';
import { ANIMATION_PROFILES } from '../src/data/reactions/animationProfiles';
import type { ReactionAnimationSceneV2 } from '../src/data/reactions/schema';
import {
  compileReactionAnimationAudit,
  hasBlockingReactionAnimationAuditIssues,
  validateReactionAnimationScene,
} from './reactionAnimationAudit';

describe('offline reaction animation compiler and audit gate', () => {
  it('reports profile coverage, mapping completeness, and quality eligibility for all 40 entries', () => {
    const report = compileReactionAnimationAudit(ALL_REACTIONS, ANIMATION_PROFILES);

    expect(report.schemaVersion).toBe('reaction-animation-audit.v1');
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.summary).toMatchObject({
      reactions: 40,
      profiles: 40,
      flows: 38,
      completeMappings: 8,
      incompleteMappings: 30,
      missingFlows: 2,
    });
    expect(report.entries).toHaveLength(40);
    expect(report.entries.find((entry) => entry.reactionId === 'na-h2o')).toMatchObject({
      mappingStatus: 'complete',
      productIdBijection: 'pass',
      reactantStoichiometry: 'pass',
      productStoichiometry: 'pass',
      equationConservation: 'pass',
      elementConservation: 'pass',
      declaredQuality: 'L3',
      qualityGate: 'pass',
    });
    expect(report.entries.find((entry) => entry.reactionId === 'nahco3-hcl')).toMatchObject({
      mappingStatus: 'incomplete',
      elementConservation: 'not-verifiable',
      qualityGate: 'illustrative-only',
    });
  });

  it.each(['na2o2-co2', 'nh3-fountain', 'glucose-cuoh2'])(
    'does not call the local reactionFlow to single productStructure mapping complete for %s',
    (reactionId) => {
      const report = compileReactionAnimationAudit(
        ALL_REACTIONS.filter((reaction) => reaction.id === reactionId),
        ANIMATION_PROFILES.filter((profile) => profile.reactionId === reactionId),
      );
      const entry = report.entries[0];

      expect(entry.mappingStatus).toBe('incomplete');
      expect(entry.elementConservation).toBe('not-verifiable');
      expect(entry.reactantStoichiometry).toBe('fail');
      expect(entry.productStoichiometry).toBe('fail');
      expect(entry.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'REACTANT_STOICHIOMETRY_MISMATCH' }),
          expect.objectContaining({ code: 'PRODUCT_STOICHIOMETRY_MISMATCH' }),
        ]),
      );
    },
  );

  it('detects non-contiguous stages and broken actor or event references', () => {
    const base = getReaction('s-o2')!;
    const invalid: ReactionAnimationSceneV2 = {
      version: 2,
      primaryFamily: 'combustion',
      environment: 'flame',
      duration: 6,
      illustrativeOnly: true,
      qualityLevel: 'L1',
      mappingReview: { status: 'incomplete', reviewedAt: '2026-08-27' },
      chemistrySignoff: { status: 'pending' },
      effects: [{
        id: 'heat', kind: 'heat-glow', at: 0, duration: 2,
        easing: 'linear', params: {},
      }],
      stages: [
        {
          id: 'one', start: 0, end: 2, stepIndex: 0,
          label: { zh: '一', en: 'one' }, status: { zh: '一', en: 'one' }, equationFocus: 'reactants',
        },
        {
          id: 'two', start: 3, end: 6, stepIndex: 1,
          label: { zh: '二', en: 'two' }, status: { zh: '二', en: 'two' }, equationFocus: 'products',
        },
      ],
      actors: [],
      events: [{
        id: 'broken', kind: 'heat', stageId: 'missing', at: 2, duration: 2,
        easing: 'linear', params: { effectId: 'ghost' }, label: { zh: '坏引用', en: 'broken ref' }, actorIds: ['ghost'],
      }],
      productGraphs: [{ id: 'main', label: { zh: '产物', en: 'product' }, structure: base.productStructure! }],
    };

    expect(validateReactionAnimationScene(invalid, base)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'STAGE_GAP' }),
        expect.objectContaining({ code: 'UNKNOWN_EVENT_STAGE' }),
        expect.objectContaining({ code: 'UNKNOWN_EVENT_ACTOR' }),
        expect.objectContaining({ code: 'UNKNOWN_EVENT_EFFECT' }),
      ]),
    );
  });

  it('fails closed when an L2 profile lacks a complete conservation proof', () => {
    const reaction = getReaction('nahco3-hcl')!;
    const profile = {
      ...ANIMATION_PROFILES.find((candidate) => candidate.reactionId === reaction.id)!,
      qualityLevel: 'L2' as const,
      illustrativeOnly: false,
      chemistrySignoff: { status: 'approved' as const, reviewer: 'test', reviewedAt: '2026-08-27' },
    };
    const report = compileReactionAnimationAudit([reaction], [profile]);

    expect(report.entries[0]).toMatchObject({
      mappingStatus: 'incomplete',
      qualityGate: 'fail',
    });
    expect(report.entries[0].issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'QUALITY_REQUIRES_CONSERVATION' })]),
    );
  });

  it('treats any entry-level error as a blocking audit result', () => {
    const report = compileReactionAnimationAudit(
      [getReaction('s-o2')!],
      [ANIMATION_PROFILES.find((profile) => profile.reactionId === 's-o2')!],
    );

    expect(hasBlockingReactionAnimationAuditIssues(report)).toBe(false);
    report.entries[0].issues.push({ code: 'TEST_ENTRY_ERROR', severity: 'error', message: 'test' });
    expect(hasBlockingReactionAnimationAuditIssues(report)).toBe(true);
  });
});
