import type {
  ReactionAnimationEffectKind,
  ReactionAnimationScene,
} from '../src/data/reactions/schema';
import {
  getActiveAnimationEffects,
  getActiveAnimationEvents,
} from './reactionAnimation';
import { isReactionAnimationConservationEligible } from './reactionAnimationGate';

export type ReactionVisualRenderer =
  | 'heat'
  | 'bubbles'
  | 'precipitate'
  | 'solution-color'
  | 'ion-field'
  | 'electron-path'
  | 'bond-rewire'
  | 'smoke';

export interface ReactionVisualDirective {
  id: string;
  renderer: ReactionVisualRenderer;
  progress: number;
  params: Record<string, string | number | boolean | number[] | string[]>;
  activeEventIds: string[];
}

const RENDERER_BY_EFFECT: Record<ReactionAnimationEffectKind, ReactionVisualRenderer> = {
  'heat-glow': 'heat',
  'gas-bubbles': 'bubbles',
  'precipitate-cloud': 'precipitate',
  'solution-color': 'solution-color',
  'ion-field': 'ion-field',
  'electron-path': 'electron-path',
  'bond-rewire': 'bond-rewire',
  'particle-smoke': 'smoke',
};

export function buildReactionVisualDirectives(
  scene: ReactionAnimationScene,
  time: number,
): ReactionVisualDirective[] {
  const activeEventIds = getActiveAnimationEvents(scene, time).map((event) => event.id);
  return getActiveAnimationEffects(scene, time).map((effect) => ({
    id: effect.id,
    renderer: RENDERER_BY_EFFECT[effect.kind],
    progress: effect.progress,
    params: effect.params,
    activeEventIds,
  }));
}

/** v1 是已签核的钠水专属场景；v2 必须同时通过数据内三道门。 */
export function canRenderAtomConservation(scene: ReactionAnimationScene): boolean {
  return isReactionAnimationConservationEligible(scene);
}
