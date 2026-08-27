import type {
  CuratedReaction,
  ReactionAnimationActor,
  ReactionAnimationEffect,
  ReactionAnimationEffectKind,
  ReactionAnimationEvent,
  ReactionAnimationEventKind,
  ReactionAnimationScene,
  ReactionAnimationSceneV2,
  ReactionAnimationStage,
} from '../src/data/reactions/schema';
import {
  getAnimationProfile,
  type ReactionAnimationProfile,
} from '../src/data/reactions/animationProfiles.ts';

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** 将带符号整数格式化为离子右上角电荷；0/undefined 保持中性且不显示。 */
export function formatCharge(charge?: number): string {
  if (!charge || !Number.isFinite(charge)) return '';
  const magnitude = Math.abs(Math.trunc(charge));
  const digits = magnitude === 1
    ? ''
    : String(magnitude).split('').map((digit) => SUPERSCRIPT_DIGITS[digit] ?? digit).join('');
  return `${digits}${charge > 0 ? '⁺' : '⁻'}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function orderedStages(animation: ReactionAnimationScene): ReactionAnimationStage[] {
  return [...animation.stages].sort((a, b) => a.start - b.start || a.end - b.end);
}

export interface AnimationSnapshot {
  time: number;
  progress: number;
  stage: ReactionAnimationStage;
  stageIndex: number;
  activeEventIds: string[];
}

export function getAnimationPrimaryFamily(animation: ReactionAnimationScene) {
  return animation.version === 1 ? animation.family : animation.primaryFamily;
}

export function getAnimationEventEffectIds(event: ReactionAnimationEvent): string[] {
  if (!('params' in event) || !event.params || typeof event.params !== 'object') return [];
  const refs: string[] = [];
  if (typeof event.params.effectId === 'string') refs.push(event.params.effectId);
  if (Array.isArray(event.params.effectIds)) {
    refs.push(...event.params.effectIds.filter((value): value is string => typeof value === 'string'));
  }
  return [...new Set(refs)];
}

function applyEasing(progress: number, easing: ReactionAnimationEffect['easing']): number {
  const p = clamp(progress, 0, 1);
  if (easing === 'ease-in') return p * p;
  if (easing === 'ease-out') return 1 - (1 - p) * (1 - p);
  if (easing === 'ease-in-out') return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  return p;
}

export function getActiveAnimationEvents(
  animation: ReactionAnimationScene,
  time: number,
): ReactionAnimationEvent[] {
  const safeTime = clamp(Number.isFinite(time) ? time : 0, 0, animation.duration);
  if (animation.version === 1) {
    const stages = orderedStages(animation);
    let stage = stages.find((candidate) => safeTime < candidate.end);
    if (!stage) stage = stages[stages.length - 1];
    if (!stage) return [];
    return animation.events.filter((event) => event.stageId === stage.id);
  }
  return animation.events.filter((event) => {
    const terminal = event.at + event.duration >= animation.duration && safeTime === animation.duration;
    return safeTime >= event.at && (safeTime < event.at + event.duration || terminal);
  });
}

export interface ActiveAnimationEffect extends ReactionAnimationEffect {
  progress: number;
}

export function getActiveAnimationEffects(
  animation: ReactionAnimationScene,
  time: number,
): ActiveAnimationEffect[] {
  if (animation.version === 1) return [];
  const safeTime = clamp(Number.isFinite(time) ? time : 0, 0, animation.duration);
  const activeEventEffectIds = new Set(
    getActiveAnimationEvents(animation, safeTime).flatMap(getAnimationEventEffectIds),
  );
  return animation.effects.flatMap((effect) => {
    if (!activeEventEffectIds.has(effect.id)) return [];
    const terminal = effect.at + effect.duration >= animation.duration && safeTime === animation.duration;
    if (safeTime < effect.at || (safeTime >= effect.at + effect.duration && !terminal)) return [];
    return [{
      ...effect,
      progress: applyEasing((safeTime - effect.at) / Math.max(0.001, effect.duration), effect.easing),
    }];
  });
}

/** 把任意拖动时间钳制到稳定、可复现的教学阶段。 */
export function getAnimationSnapshot(animation: ReactionAnimationScene, time: number): AnimationSnapshot {
  const stages = orderedStages(animation);
  if (stages.length === 0) {
    throw new Error('Reaction animation must define at least one stage');
  }
  const safeTime = clamp(Number.isFinite(time) ? time : 0, 0, animation.duration);
  let stageIndex = stages.findIndex((stage) => safeTime < stage.end);
  if (stageIndex < 0) stageIndex = stages.length - 1;
  const stage = stages[stageIndex];
  const span = Math.max(0.001, stage.end - stage.start);
  const progress = clamp((safeTime - stage.start) / span, 0, 1);
  const activeEventIds = getActiveAnimationEvents(animation, safeTime).map((event) => event.id);
  return { time: safeTime, progress, stage, stageIndex, activeEventIds };
}

export function getStageForStep(
  animation: ReactionAnimationScene,
  stepIndex: number,
): ReactionAnimationStage | undefined {
  return orderedStages(animation).find((stage) => stage.stepIndex === stepIndex);
}

/** 左侧步骤点击时使用阶段起点，保证文字和画面从同一个节拍开始。 */
export function getStepSeekTime(animation: ReactionAnimationScene, stepIndex: number): number {
  return getStageForStep(animation, stepIndex)?.start ?? animation.duration;
}

export interface AnimationStepNavigationState {
  time: number;
  playing: false;
}

/** 节拍导航是定位动作：无论当前是否播放，跳转后都停在新节拍起点。 */
export function getStepNavigationState(
  animation: ReactionAnimationScene,
  stepIndex: number,
): AnimationStepNavigationState {
  return { time: getStepSeekTime(animation, stepIndex), playing: false };
}

/** 阶段视觉采用半开区间，保证前一阶段不会提前出现，阶段起点会立即出现。 */
export function isStageActiveAt(
  animation: ReactionAnimationScene,
  stageId: string,
  time: number,
): boolean {
  const stage = animation.stages.find((candidate) => candidate.id === stageId);
  if (!stage) return false;
  const safeTime = clamp(Number.isFinite(time) ? time : 0, 0, animation.duration);
  const isTerminalFrame = stage.end >= animation.duration && safeTime === animation.duration;
  return safeTime >= stage.start && (safeTime < stage.end || isTerminalFrame);
}

export interface EquationParts {
  reactants: string;
  arrow: string;
  products: string;
}

/** 只拆分展示层方程式，不改动数据中的原始化学计量文本。 */
export function getEquationParts(equation: string): EquationParts {
  const explicitArrow = equation.match(/(⇌|→|⟶)/);
  const spacedEqualsIndex = equation.indexOf(' = ');
  const arrow = explicitArrow?.[0] ?? (spacedEqualsIndex >= 0 ? '=' : '');
  const arrowIndex = explicitArrow?.index ?? (spacedEqualsIndex >= 0 ? spacedEqualsIndex + 1 : -1);
  if (!arrow || arrowIndex < 0) {
    return { reactants: equation, arrow: '', products: '' };
  }
  return {
    reactants: equation.slice(0, arrowIndex).trim(),
    arrow,
    products: equation.slice(arrowIndex + arrow.length).trim(),
  };
}

/** 为尚未拥有专属 scene 的条目选择编排族，供后续 family renderer 渐进升级。 */
export function inferReactionAnimationFamily(
  reaction: CuratedReaction,
): 'ionic' | 'combustion' | 'gas-evolution' | 'precipitation-color' | 'organic-bond' | 'generic' {
  if (reaction.reactionAnimation) return getAnimationPrimaryFamily(reaction.reactionAnimation);
  return getAnimationProfile(reaction.id)?.primaryFamily ?? 'generic';
}

function eventKindForEffect(kind: ReactionAnimationEffectKind | undefined): ReactionAnimationEventKind {
  if (kind === 'heat-glow') return 'heat';
  if (kind === 'gas-bubbles' || kind === 'particle-smoke') return 'gas-bubble';
  if (kind === 'precipitate-cloud') return 'precipitate';
  if (kind === 'solution-color') return 'color-change';
  if (kind === 'electron-path') return 'electron-transfer';
  if (kind === 'ion-field') return 'ionize';
  if (kind === 'bond-rewire') return 'bond-form';
  return 'observe';
}

function buildFallbackAnimationActors(
  flow: NonNullable<CuratedReaction['reactionFlow']>,
  productStructure: NonNullable<CuratedReaction['productStructure']>,
): ReactionAnimationActor[] {
  const actors: ReactionAnimationActor[] = [];
  flow.reactants.forEach((reactant, reactantIndex) => {
    actors.push({
      id: `reactant-${reactantIndex}`,
      kind: 'species',
      label: { zh: reactant.label, en: reactant.label },
      position: reactant.position,
      formula: reactant.label,
    });
    reactant.structure.atoms.forEach((atom) => {
      const mapping = flow.atomMap.find((candidate) => (
        candidate.reactant === reactantIndex && candidate.atom === atom.id
      ));
      const target = mapping
        ? productStructure.atoms.find((candidate) => candidate.id === mapping.to)
        : undefined;
      actors.push({
        id: `reactant-${reactantIndex}-atom-${atom.id}`,
        kind: 'atom',
        label: { zh: atom.element, en: atom.element },
        position: [
          reactant.position[0] + atom.x / 2,
          reactant.position[1] + atom.y / 2,
          reactant.position[2] + atom.z / 2,
        ],
        target: target ? [target.x / 2, target.y / 2, target.z / 2] : undefined,
        element: atom.element,
        charge: atom.charge,
        color: atom.color,
      });
    });
  });
  productStructure.atoms.forEach((atom) => {
    actors.push({
      id: `product-atom-${atom.id}`,
      kind: 'atom',
      label: { zh: atom.element, en: atom.element },
      position: [atom.x / 2, atom.y / 2, atom.z / 2],
      element: atom.element,
      charge: atom.charge,
      color: atom.color,
    });
  });
  return actors;
}

/** 没有专属场景时，给旧 reactionFlow 提供可控时间轴和教学状态。 */
export function createFallbackReactionAnimation(
  reaction: CuratedReaction,
  explicitProfile?: ReactionAnimationProfile,
): ReactionAnimationSceneV2 | null {
  if (!reaction.reactionFlow) return null;
  const profile = explicitProfile ?? getAnimationProfile(reaction.id);
  const stageCount = Math.max(1, reaction.mechanismSteps.length);
  const stageDuration = 3;
  const labels = [
    { zh: '反应物进入视野', en: 'Reactants enter the scene' },
    { zh: '粒子开始重排', en: 'Particles begin to rearrange' },
    { zh: '原子迁移', en: 'Atoms migrate' },
    { zh: '产物逐步形成', en: 'Products assemble' },
    { zh: '观察最终产物', en: 'Observe the products' },
  ];
  const focuses: Array<'reactants' | 'change' | 'products' | 'observation'> = [
    'reactants',
    'change',
    'change',
    'products',
    'observation',
  ];
  const stages = Array.from({ length: stageCount }, (_, index) => ({
    id: `legacy-${index + 1}`,
    start: index * stageDuration,
    end: (index + 1) * stageDuration,
    stepIndex: index,
    label: labels[Math.min(index, labels.length - 1)],
    status: {
      zh: reaction.mechanismSteps[index] ?? labels[Math.min(index, labels.length - 1)].zh,
      en: reaction.mechanismSteps[index] ?? labels[Math.min(index, labels.length - 1)].en,
    },
    equationFocus: focuses[Math.min(index, focuses.length - 1)],
  }));
  const duration = stageCount * stageDuration;
  const family = profile?.primaryFamily ?? 'generic';
  const environment = profile?.environment ?? 'none';
  const profileEffects = profile?.effects ?? [{ kind: 'particle-smoke' as const, params: {} }];
  const effects: ReactionAnimationEffect[] = stages.map((stage, index) => {
    const effect = profileEffects[index % profileEffects.length];
    return {
      id: `${reaction.id}-${effect.kind}-${index + 1}`,
      kind: effect.kind,
      at: stage.start,
      duration: Math.max(0.1, stage.end - stage.start),
      easing: 'ease-in-out',
      params: effect.params,
    };
  });
  return {
    version: 2,
    primaryFamily: family,
    environment,
    duration,
    illustrativeOnly: profile?.illustrativeOnly ?? true,
    qualityLevel: profile?.qualityLevel ?? 'L0',
    mappingReview: profile?.mappingReview ?? { status: 'missing', note: 'No explicit animation profile' },
    chemistrySignoff: profile?.chemistrySignoff ?? { status: 'pending' },
    effects,
    stages,
    actors: buildFallbackAnimationActors(reaction.reactionFlow, reaction.productStructure ?? {
      atoms: [],
      bonds: [],
    }),
    events: stages.map((stage, index) => {
      const stageEffects = effects.filter((effect) => effect.at === stage.start);
      const effect = stageEffects[0];
      const reactantSpecies = reaction.reactionFlow?.reactants.map((_, reactantIndex) => `reactant-${reactantIndex}`) ?? [];
      const sourceAtoms = reaction.reactionFlow?.atomMap.map((mapping) => `reactant-${mapping.reactant}-atom-${mapping.atom}`) ?? [];
      const productAtoms = (reaction.productStructure?.atoms ?? []).map((atom) => `product-atom-${atom.id}`);
      const actorIds = index === 0
        ? reactantSpecies
        : index === stages.length - 1
          ? productAtoms
          : sourceAtoms;
      const effectParams = stageEffects.length > 1
        ? { effectIds: stageEffects.map((candidate) => candidate.id) }
        : effect
          ? { effectId: effect.id }
          : {};
      return {
        id: `${stage.id}-event`,
        kind: eventKindForEffect(effect?.kind),
        stageId: stage.id,
        at: stage.start,
        duration: stage.end - stage.start,
        easing: 'ease-in-out',
        params: {
          ...effectParams,
          stateCues: profile?.stateCues ?? [],
          phenomena: profile?.phenomena ?? [],
        },
        actorIds,
        label: stage.label,
      };
    }),
    productGraphs: reaction.productStructure
      ? [{
          id: 'main-product',
          label: { zh: reaction.products.join('、'), en: reaction.products.join(', ') },
          structure: reaction.productStructure,
        }]
      : undefined,
    evidence: profile?.evidence,
  };
}
