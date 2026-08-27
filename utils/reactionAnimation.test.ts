import { describe, expect, it } from 'vitest';
import { getReaction } from '../src/data/reactions';
import {
  formatCharge,
  getAnimationSnapshot,
  getEquationParts,
  getStepSeekTime,
  getStepNavigationState,
  getStageForStep,
  inferReactionAnimationFamily,
  isStageActiveAt,
} from './reactionAnimation';

describe('reaction animation timeline', () => {
  const sodium = getReaction('na-h2o');

  it('exposes deterministic stage and step lookups for the sodium-water lesson', () => {
    const animation = sodium?.reactionAnimation;
    expect(animation).toBeDefined();
    if (!animation) return;

    expect(animation.family).toBe('ionic');
    expect(animation.duration).toBeGreaterThan(0);
    expect(getAnimationSnapshot(animation, 0).stage.id).toBe('surface');
    expect(getAnimationSnapshot(animation, 3.1).stage.id).toBe('melt');
    expect(getAnimationSnapshot(animation, animation.duration).stage.id).toBe('hydrogen');
    expect(getStageForStep(animation, 3)?.id).toBe('ions');
  });

  it('formats ion charges without turning neutral atoms into ions', () => {
    expect(formatCharge(1)).toBe('⁺');
    expect(formatCharge(-1)).toBe('⁻');
    expect(formatCharge(2)).toBe('²⁺');
    expect(formatCharge(0)).toBe('');
    expect(formatCharge(undefined)).toBe('');
  });

  it('provides stable seek points and equation regions for timeline controls', () => {
    const animation = sodium?.reactionAnimation;
    expect(animation).toBeDefined();
    if (!animation) return;

    expect(getStepSeekTime(animation, 0)).toBe(0);
    expect(getStepSeekTime(animation, 3)).toBe(9.5);
    expect(getStepSeekTime(animation, 99)).toBe(animation.duration);
    expect(getEquationParts('2Na + 2H₂O = 2NaOH + H₂↑')).toEqual({
      reactants: '2Na + 2H₂O',
      arrow: '=',
      products: '2NaOH + H₂↑',
    });
    expect(getEquationParts('CH₂=CH₂ + Br₂ → CH₂Br—CH₂Br')).toEqual({
      reactants: 'CH₂=CH₂ + Br₂',
      arrow: '→',
      products: 'CH₂Br—CH₂Br',
    });
  });

  it('pauses playback whenever a timeline step navigation state is requested', () => {
    const animation = sodium?.reactionAnimation;
    expect(animation).toBeDefined();
    if (!animation) return;

    expect(getStepNavigationState(animation, 3)).toEqual({ time: 9.5, playing: false });
  });

  it('shows electron transfer at its exact stage start, but not in the prior stage', () => {
    const animation = sodium?.reactionAnimation;
    expect(animation).toBeDefined();
    if (!animation) return;

    expect(isStageActiveAt(animation, 'electron', 6.099)).toBe(false);
    expect(isStageActiveAt(animation, 'electron', 6.1)).toBe(true);
    expect(isStageActiveAt(animation, 'electron', 9.499)).toBe(true);
    expect(isStageActiveAt(animation, 'electron', 9.5)).toBe(false);
  });

  it('classifies legacy reactions into distinct choreography families', () => {
    expect(inferReactionAnimationFamily(getReaction('na-o2-heat')!)).toBe('combustion');
    expect(inferReactionAnimationFamily(getReaction('nahco3-hcl')!)).toBe('gas-evolution');
    expect(inferReactionAnimationFamily(getReaction('cl2-nabr-displace')!)).toBe('precipitation-color');
    expect(inferReactionAnimationFamily(getReaction('c2h4-br2')!)).toBe('organic-bond');
  });

  it('keeps the sodium-water products ionic and maps every hydrogen into a product', () => {
    const reaction = sodium;
    expect(reaction).toBeDefined();
    if (!reaction?.productStructure || !reaction.reactionFlow || !reaction.reactionAnimation) return;

    expect(reaction.productStructure.atoms).toHaveLength(8);
    expect(reaction.productStructure.bonds).toEqual(
      expect.arrayContaining([
        { source: 2, target: 3, order: 1 },
        { source: 5, target: 6, order: 1 },
        { source: 7, target: 8, order: 1 },
      ]),
    );
    expect(reaction.productStructure.bonds).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 1, target: 2 }),
        expect.objectContaining({ source: 2, target: 1 }),
      ]),
    );
    expect(reaction.productStructure.atoms.find((atom) => atom.id === 1)?.charge).toBe(1);
    expect(reaction.productStructure.atoms.find((atom) => atom.id === 2)?.charge).toBe(-1);

    const mapped = reaction.reactionFlow.atomMap.map((entry) => `${entry.reactant}:${entry.atom}`);
    const allReactantAtoms = reaction.reactionFlow.reactants.flatMap((reactant, reactantIndex) =>
      reactant.structure.atoms.map((atom) => `${reactantIndex}:${atom.id}`),
    );
    expect(new Set(mapped)).toEqual(new Set(allReactantAtoms));
    expect(reaction.reactionAnimation.events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(['electron-transfer', 'gas-bubble', 'ionize', 'color-change']),
    );
  });
});
