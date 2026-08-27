import React from 'react';
import type { FlagshipTrackEvent } from '../src/data/reactions/schema';
import type { FlagshipMicroKind } from '../src/data/reactions/flagshipScenes';
import { useLanguage } from '../contexts/LanguageContext';

interface MicroStageCopy {
  before: string[];
  after: string[];
  actionZh: string;
  actionEn: string;
  noteZh: string;
  noteEn: string;
  tone: 'sulfur' | 'gas' | 'organic' | 'ionic';
}

const MICRO_STAGES: Record<FlagshipMicroKind, MicroStageCopy> = {
  'reactant-distribution': { before: ['S', 'O=O'], after: ['S', 'O=O'], actionZh: '反应物分开', actionEn: 'reactants separate', noteZh: '先识别硫原子与氧分子', noteEn: 'Identify sulfur and oxygen first', tone: 'sulfur' },
  'heating-condition': { before: ['S', 'O=O'], after: ['S*', 'O=O'], actionZh: '加热提供能量', actionEn: 'heat supplies energy', noteZh: '加热是条件，不进入原子计量', noteEn: 'Heat is a condition, not a counted atom', tone: 'sulfur' },
  'oxygen-bond-change': { before: ['S', 'O=O'], after: ['O—S—O'], actionZh: 'O=O 重排并形成 S—O', actionEn: 'O=O rearranges into S—O bonds', noteZh: '一个 S 与两个 O 进入 SO₂', noteEn: 'One S and two O atoms enter SO₂', tone: 'sulfur' },
  'so2-diffusion': { before: ['O—S—O'], after: ['SO₂', 'SO₂', 'SO₂'], actionZh: '产物分子扩散', actionEn: 'product molecules diffuse', noteZh: '扩散示意不代表真实速率', noteEn: 'Diffusion is schematic, not to scale', tone: 'sulfur' },
  'gas-distribution': { before: ['NH₃', 'H—Cl'], after: ['NH₃', 'H—Cl'], actionZh: '两种无色气体分布', actionEn: 'two colorless gases distribute', noteZh: '此时还没有白色固体微粒', noteEn: 'No white solid particles exist yet', tone: 'gas' },
  diffusion: { before: ['NH₃  →', '←  HCl'], after: ['NH₃ ··· HCl'], actionZh: '扩散并相遇', actionEn: 'diffuse and meet', noteZh: '相遇位置只作定性示意', noteEn: 'Meeting position is qualitative only', tone: 'gas' },
  'proton-transfer': { before: ['NH₃', 'H—Cl'], after: ['NH₄⁺', 'Cl⁻'], actionZh: 'H⁺ 转移', actionEn: 'H⁺ transfers', noteZh: '总电荷仍为 0', noteEn: 'Net charge remains zero', tone: 'gas' },
  'ionic-particle-aggregation': { before: ['NH₄⁺', 'Cl⁻'], after: ['NH₄Cl', 'NH₄Cl', 'NH₄Cl'], actionZh: '离子聚集成微小晶粒', actionEn: 'ions gather into tiny crystals', noteZh: '固体微粒散射光，形成白烟', noteEn: 'Solid particles scatter light as white smoke', tone: 'gas' },
  'alkene-and-bromine': { before: ['CH₂=CH₂', 'Br—Br'], after: ['CH₂=CH₂', 'Br—Br'], actionZh: '识别双键与溴分子', actionEn: 'identify the double bond and bromine', noteZh: '非水惰性介质教学模型', noteEn: 'Non-aqueous inert-medium model', tone: 'organic' },
  'double-bond-approach': { before: ['CH₂=CH₂', 'Br—Br'], after: ['CH₂=CH₂ ··· Br—Br'], actionZh: 'Br₂ 接近 π 键区域', actionEn: 'Br₂ approaches the π-bond region', noteZh: '接近不等于原子已经成键', noteEn: 'Approach does not yet mean bonding', tone: 'organic' },
  'pi-bond-rewire': { before: ['C=C', 'Br—Br'], after: ['Br···C—C···Br'], actionZh: 'π 键与 Br—Br 键重排', actionEn: 'π and Br—Br bonds rearrange', noteZh: '旧键变化，两个 C—Br 键开始形成', noteEn: 'Old bonds change as two C—Br bonds form', tone: 'organic' },
  'dibromo-formation': { before: ['Br···C—C···Br'], after: ['CH₂Br—CH₂Br'], actionZh: '加成产物形成', actionEn: 'addition product forms', noteZh: '每个碳各连接一个 Br', noteEn: 'Each carbon receives one Br atom', tone: 'organic' },
  'bromine-consumption': { before: ['Br₂', 'CH₂=CH₂'], after: ['CH₂Br—CH₂Br'], actionZh: 'Br₂ 被消耗', actionEn: 'Br₂ is consumed', noteZh: '原子未消失，只是进入产物', noteEn: 'Atoms enter the product; none disappear', tone: 'organic' },
  'crystal-and-water': { before: ['Ca²⁺ O²⁻', 'H—O—H'], after: ['Ca²⁺ O²⁻', 'H—O—H'], actionZh: '晶格与水分开', actionEn: 'lattice and water separate', noteZh: '先追踪 Ca、O、H 的来源', noteEn: 'Track the sources of Ca, O and H', tone: 'ionic' },
  'surface-hydration': { before: ['Ca²⁺ O²⁻', 'H₂O →'], after: ['CaO ··· H₂O'], actionZh: '水分子接近表面', actionEn: 'water approaches the surface', noteZh: '水在这里是反应物', noteEn: 'Water is a reactant here', tone: 'ionic' },
  'hydroxide-reorganization': { before: ['Ca²⁺', 'O²⁻', 'H₂O'], after: ['Ca²⁺', '2 OH⁻'], actionZh: '离子环境重组', actionEn: 'ionic environment reorganizes', noteZh: '形成两个氢氧根配位单元', noteEn: 'Two hydroxide units are formed', tone: 'ionic' },
  'energy-release': { before: ['CaO + H₂O'], after: ['Ca(OH)₂', 'heat ↑'], actionZh: '结构重组并放热', actionEn: 'reorganization releases heat', noteZh: '能量脉冲不表示具体热值', noteEn: 'Energy pulses do not encode a measured value', tone: 'ionic' },
  'product-structure': { before: ['Ca²⁺', 'OH⁻', 'OH⁻'], after: ['Ca(OH)₂'], actionZh: '熟石灰结构示意', actionEn: 'slaked-lime structure model', noteZh: '化学式与原子守恒同时闭合', noteEn: 'Formula and atom conservation close together', tone: 'ionic' },
  'interface-contact': { before: ['Na', 'H—O—H'], after: ['Na ··· H₂O'], actionZh: '钠与水界面接触', actionEn: 'sodium contacts the water interface', noteZh: 'L3 钠水场景由专属三维轨呈现', noteEn: 'The L3 sodium-water scene uses its dedicated 3D track', tone: 'ionic' },
  'electron-transfer': { before: ['Na', 'H₂O'], after: ['Na⁺', 'e⁻ → H'], actionZh: '电子由钠转移', actionEn: 'electron transfers from sodium', noteZh: '电子轨迹由专属三维场景呈现', noteEn: 'The electron path is shown in the dedicated 3D scene', tone: 'ionic' },
  'hydrogen-recombination': { before: ['H', 'H'], after: ['H—H ↑'], actionZh: '氢原子重组', actionEn: 'hydrogen atoms recombine', noteZh: '生成 H₂ 并逸出水面', noteEn: 'H₂ forms and leaves the water surface', tone: 'ionic' },
  'ion-dispersion': { before: ['Na⁺', 'OH⁻'], after: ['Na⁺(aq)', 'OH⁻(aq)'], actionZh: '离子在水中分散', actionEn: 'ions disperse in water', noteZh: '溶液呈碱性', noteEn: 'The solution becomes alkaline', tone: 'ionic' },
};

const TONES = {
  sulfur: { accent: '#73a9ff', glow: 'rgba(84,137,255,0.28)' },
  gas: { accent: '#e7eef1', glow: 'rgba(231,238,241,0.24)' },
  organic: { accent: '#d67a68', glow: 'rgba(183,69,52,0.28)' },
  ionic: { accent: '#8fe8dc', glow: 'rgba(85,205,191,0.26)' },
} as const;

export interface FlagshipMicroStageProps {
  event: FlagshipTrackEvent;
  progress: number;
  reducedMotion: boolean;
}

const FormulaGroup: React.FC<{
  formulas: string[];
  accent: string;
  opacity: number;
  offset: number;
}> = ({ formulas, accent, opacity, offset }) => (
  <div
    className="flex max-w-[43%] flex-wrap items-center justify-center gap-2 transition-[opacity,transform] duration-200"
    style={{ opacity, transform: `translateX(${offset}px)` }}
  >
    {formulas.map((formula, index) => (
      <span
        key={`${formula}-${index}`}
        className="rounded-xl border bg-[#142128]/90 px-3 py-2 font-mono text-sm font-semibold shadow-lg sm:text-base"
        style={{ borderColor: `${accent}66`, color: accent }}
      >
        {formula}
      </span>
    ))}
  </div>
);

export const FlagshipMicroStage: React.FC<FlagshipMicroStageProps> = ({
  event,
  progress,
  reducedMotion,
}) => {
  const { language } = useLanguage();
  const stage = MICRO_STAGES[event.kind as FlagshipMicroKind] ?? {
    before: ['reactants'],
    after: ['products'],
    actionZh: '粒子重组',
    actionEn: 'particles reorganize',
    noteZh: '教学粒子模型',
    noteEn: 'Educational particle model',
    tone: 'ionic' as const,
  };
  const visualProgress = reducedMotion ? 1 : Math.min(1, Math.max(0, progress));
  const tone = TONES[stage.tone];
  const beforeOpacity = 1 - visualProgress * 0.48;
  const afterOpacity = 0.35 + visualProgress * 0.65;
  const isCloud = event.kind.includes('diffusion') || event.kind.includes('aggregation');
  const isEnergy = event.kind === 'energy-release' || event.kind === 'heating-condition';

  return (
    <section
      className="relative flex h-full min-h-[190px] flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_48%,rgba(143,232,220,0.08),transparent_42%),linear-gradient(145deg,#101a20,#16262d)]"
      data-micro-kind={event.kind}
      data-micro-progress={visualProgress.toFixed(2)}
      aria-label={language === 'zh' ? stage.actionZh : stage.actionEn}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      {(isCloud || isEnergy) && Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className="pointer-events-none absolute h-2 w-2 rounded-full"
          style={{
            left: `${17 + ((index * 19) % 68)}%`,
            top: `${20 + ((index * 23) % 56)}%`,
            background: tone.accent,
            boxShadow: `0 0 ${10 + visualProgress * 18}px ${tone.glow}`,
            opacity: 0.16 + visualProgress * 0.56,
            transform: `scale(${0.65 + visualProgress * (0.35 + (index % 3) * 0.2)}) translateY(${isEnergy ? -visualProgress * (10 + index) : 0}px)`,
          }}
        />
      ))}
      <div className="relative z-10 flex flex-1 items-center justify-between gap-3 px-4 py-5 sm:px-6">
        <FormulaGroup formulas={stage.before} accent="#ffe0a5" opacity={beforeOpacity} offset={visualProgress * 10} />
        <div className="flex min-w-[88px] flex-1 flex-col items-center gap-2 text-center">
          <div className="relative h-px w-full bg-white/20">
            <span className="absolute -top-1.5 h-3 w-3 rounded-full" style={{ left: `${Math.max(0, visualProgress * 100 - 4)}%`, background: tone.accent, boxShadow: `0 0 16px ${tone.glow}` }} />
          </div>
          <span className="max-w-[150px] text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: tone.accent }}>
            {language === 'zh' ? stage.actionZh : stage.actionEn}
          </span>
        </div>
        <FormulaGroup formulas={stage.after} accent={tone.accent} opacity={afterOpacity} offset={(1 - visualProgress) * -10} />
      </div>
      <p className="relative z-10 border-t border-white/10 bg-black/10 px-3 py-2 text-center text-[10px] leading-relaxed text-white/58">
        {language === 'zh' ? stage.noteZh : stage.noteEn} · {language === 'zh' ? '教学粒子模型，非真实比例或速率' : 'Educational particle model; not to scale or rate'}
      </p>
    </section>
  );
};
