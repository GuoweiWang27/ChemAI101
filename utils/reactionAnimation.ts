import type {
  CuratedReaction,
  ReactionAnimationScene,
  ReactionAnimationStage,
} from '../src/data/reactions/schema';

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
  const activeEventIds = animation.events
    .filter((event) => event.stageId === stage.id)
    .map((event) => event.id);
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
  const match = equation.match(/(⇌|→|=|⟶)/);
  if (!match || match.index === undefined) {
    return { reactants: equation, arrow: '', products: '' };
  }
  return {
    reactants: equation.slice(0, match.index).trim(),
    arrow: match[0],
    products: equation.slice(match.index + match[0].length).trim(),
  };
}

/** 为尚未拥有专属 scene 的条目选择编排族，供后续 family renderer 渐进升级。 */
export function inferReactionAnimationFamily(
  reaction: CuratedReaction,
): 'ionic' | 'combustion' | 'gas-evolution' | 'precipitation-color' | 'organic-bond' | 'generic' {
  if (reaction.reactionAnimation) return reaction.reactionAnimation.family;
  const key = `${reaction.id} ${reaction.title} ${reaction.reactants} ${reaction.products.join(' ')}`.toLowerCase();
  if (/c2h4|esterification|ethanol|glucose|organic|乙烯|乙醇|酯|葡萄糖/.test(key)) return 'organic-bond';
  if (/cl2-nabr|fecl2-cl2|fecl3-fe|fecl3-cu|color|变色|颜色/.test(key)) return 'precipitation-color';
  if (/na-o2|cl2-na|cl2-fe|cl2-cu|cl2-h2|s-o2|燃烧|点燃/.test(key)) return 'combustion';
  if (/↑|h2|h₂|co2|co₂|o2|o₂|nh3|nh₃|so2|so₂|no2|no₂|气体|气泡|氢气|氧气|二氧化碳|喷泉/.test(key)) return 'gas-evolution';
  if (/naoh|oh|hcl|hno3|离子|盐酸|氢氧化/.test(key)) return 'ionic';
  return 'generic';
}

/** 没有专属场景时，给旧 reactionFlow 提供可控时间轴和教学状态。 */
export function createFallbackReactionAnimation(reaction: CuratedReaction): ReactionAnimationScene | null {
  if (!reaction.reactionFlow) return null;
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
  const family = inferReactionAnimationFamily(reaction);
  const environment = family === 'combustion'
    ? 'flame'
    : family === 'gas-evolution'
      ? 'gas-jar'
      : family === 'precipitation-color'
        ? 'solution'
        : family === 'organic-bond'
          ? 'organic-vessel'
          : 'none';
  const eventKind = family === 'combustion'
    ? 'heat'
    : family === 'gas-evolution'
      ? 'gas-bubble'
      : family === 'precipitation-color'
        ? 'color-change'
        : family === 'organic-bond'
          ? 'bond-form'
          : 'observe';
  return {
    version: 1,
    family,
    environment,
    duration: stageCount * stageDuration,
    stages,
    actors: [],
    events: stages.map((stage) => ({
      id: `${stage.id}-event`,
      kind: eventKind,
      stageId: stage.id,
      label: stage.label,
    })),
  };
}
