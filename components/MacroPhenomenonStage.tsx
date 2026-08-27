import React from 'react';
import type { CSSProperties } from 'react';
import type { ReactionAnimationSceneV3 } from '../src/data/reactions/schema';
import { useLanguage } from '../contexts/LanguageContext';

export interface MacroPhenomenonStageProps {
  event: ReactionAnimationSceneV3['macroTrack'][number];
  progress: number;
  reducedMotion: boolean;
}

const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

function paramString(
  event: MacroPhenomenonStageProps['event'],
  key: string,
  fallback: string,
): string {
  const value = event.params[key];
  return typeof value === 'string' ? value : fallback;
}

function paramNumber(
  event: MacroPhenomenonStageProps['event'],
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = event.params[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
}

function paramBoolean(
  event: MacroPhenomenonStageProps['event'],
  key: string,
): boolean {
  return event.params[key] === true;
}

function hexToRgb(value: string): [number, number, number] | null {
  const match = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function interpolateColor(from: string, to: string, progress: number): string {
  const start = hexToRgb(from);
  const end = hexToRgb(to);
  if (!start || !end) return progress < 0.5 ? from : to;
  const p = clamp(progress);
  return `rgb(${start.map((value, index) => Math.round(value + (end[index] - value) * p)).join(', ')})`;
}

export function getMacroVisualProgress(
  event: MacroPhenomenonStageProps['event'],
  stageProgress: number,
): number {
  if (!paramBoolean(event, 'cumulativeAcrossStages')) return clamp(stageProgress);
  const stageIndex = paramNumber(event, ['stageIndex']) ?? 0;
  const stageCount = Math.max(1, paramNumber(event, ['stageCount']) ?? 1);
  return clamp((stageIndex + stageProgress) / stageCount);
}

const layerStyle = (reducedMotion: boolean, progress: number, extra: CSSProperties = {}): CSSProperties => ({
  ...extra,
  opacity: reducedMotion ? 0.45 + progress * 0.45 : extra.opacity ?? 0.55 + progress * 0.45,
  transition: reducedMotion ? 'opacity 160ms ease-out' : 'transform 240ms ease-out, opacity 240ms ease-out',
});

const MetalOnWater: React.FC<MacroPhenomenonStageProps> = ({ event, progress, reducedMotion }) => {
  const { language } = useLanguage();
  const mayIgnite = paramBoolean(event, 'mayIgnite');
  const beadLeft = reducedMotion ? '49%' : `${29 + progress * 38}%`;
  return (
    <div className="absolute inset-3 overflow-hidden rounded-2xl border border-cyan-200/20 bg-gradient-to-b from-slate-950/20 to-cyan-950/40">
      <div className="absolute inset-x-0 bottom-0 h-[42%] border-t border-cyan-200/30 bg-cyan-500/20" />
      <div className="absolute inset-x-[8%] bottom-[42%] h-px bg-cyan-100/70" />
      <div
        className="absolute bottom-[43%] h-5 w-5 rounded-full border-2 border-[#e6b7ff] bg-[#a95ae0] shadow-[0_0_18px_rgba(199,125,255,0.8)]"
        style={layerStyle(reducedMotion, progress, { left: beadLeft, transform: reducedMotion ? undefined : `translateX(${Math.sin(progress * Math.PI) * 18}px)` })}
        aria-label={event.label.en}
      />
      <div
        className="absolute bottom-[45%] h-1 rounded-full bg-[#e6b7ff]/50"
        style={{ left: reducedMotion ? '39%' : `${27 + progress * 34}%`, width: reducedMotion ? '20%' : `${20 + progress * 16}%`, opacity: reducedMotion ? 0.5 : 0.25 + progress * 0.55 }}
      />
      {Array.from({ length: 6 }, (_, index) => (
        <span
          key={index}
          className="absolute rounded-full border border-cyan-100/70"
          style={{
            left: `${34 + index * 8}%`,
            bottom: `${47 + (index % 3) * 7}%`,
            width: `${5 + (index % 2) * 3}px`,
            height: `${5 + (index % 2) * 3}px`,
            opacity: reducedMotion ? 0.35 + progress * 0.35 : progress * 0.8,
            transform: reducedMotion ? undefined : `translateY(${-progress * (8 + index * 3)}px)`,
          }}
        />
      ))}
      {mayIgnite && progress > 0.65 && (
        <div className="absolute bottom-[51%] left-[54%] h-16 w-10 -translate-x-1/2" aria-label="Conditional flame">
          <div className="absolute inset-x-1 bottom-0 h-12 rounded-[55%_45%_55%_45%] bg-amber-300/90 blur-[1px]" />
          <div className="absolute inset-x-3 bottom-2 h-8 rounded-[60%_40%_60%_40%] bg-yellow-50/90" />
        </div>
      )}
      {mayIgnite && (
        <span className="absolute right-3 top-3 max-w-[170px] rounded-full border border-amber-200/35 bg-slate-950/60 px-2.5 py-1 text-center text-[9px] font-semibold leading-relaxed text-amber-100">
          {language === 'zh' ? '特定条件下可能出现黄色火焰' : 'A yellow flame may appear under specific conditions'}
        </span>
      )}
    </div>
  );
};

const Flame: React.FC<MacroPhenomenonStageProps> = ({ event, progress, reducedMotion }) => {
  const color = paramString(event, 'color', '#4aa8ff');
  const secondary = paramString(event, 'secondaryColor', '#8b8dff');
  return (
    <div className="absolute inset-3 flex items-end justify-center overflow-hidden rounded-2xl border border-blue-200/20 bg-gradient-to-b from-slate-950/30 to-blue-950/30">
      <div className="absolute bottom-5 h-28 w-36 rounded-[50%] bg-blue-400/10 blur-2xl" />
      <div
        className="relative mb-7 h-36 w-24 rounded-[58%_42%_58%_42%] blur-[1px]"
        style={layerStyle(reducedMotion, progress, {
          background: `linear-gradient(180deg, ${secondary}, ${color} 55%, #e7f5ff)`,
          transform: reducedMotion ? undefined : `scale(${0.78 + progress * 0.2})`,
        })}
      >
        <div className="absolute inset-x-6 bottom-4 h-20 rounded-[55%_45%_65%_35%] bg-white/75" />
      </div>
    </div>
  );
};

const Smoke: React.FC<MacroPhenomenonStageProps> = ({ event, progress, reducedMotion }) => {
  const { language } = useLanguage();
  const color = paramString(event, 'color', '#f4f1ea');
  const mode = paramString(event, 'mode', 'white-particles');
  const showParticles = mode !== 'opposing-gases';
  return (
    <div className="absolute inset-3 overflow-hidden rounded-2xl border border-slate-200/20 bg-gradient-to-b from-slate-950/20 to-slate-500/10">
      <div className="absolute left-[7%] top-1/2 h-1 w-[37%] -translate-y-1/2 rounded-full bg-white/25" />
      <div className="absolute right-[7%] top-1/2 h-1 w-[37%] -translate-y-1/2 rounded-full bg-white/25" />
      {showParticles && Array.from({ length: 10 }, (_, index) => {
        const angle = (index / 10) * Math.PI * 2;
        const distance = reducedMotion ? 19 : progress * 42;
        return (
          <span
            key={index}
            className="absolute left-1/2 top-1/2 h-3 w-3 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.3)]"
            style={{
              backgroundColor: color,
              opacity: reducedMotion ? 0.2 + progress * 0.5 : progress * 0.72,
              transform: `translate(-50%, -50%) translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance * 0.65}px)`,
            }}
          />
        );
      })}
      {showParticles && <div className="absolute left-1/2 top-1/2 h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20 blur-xl" style={{ opacity: reducedMotion ? 0.25 + progress * 0.4 : progress * 0.65 }} />}
      {!showParticles && (
        <span
          aria-label="no smoke yet"
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md border border-white/15 bg-black/20 px-2 py-1 text-[11px] font-medium text-white/65"
        >
          {language === 'zh' ? '尚未形成白烟' : 'No visible white smoke yet'}
        </span>
      )}
    </div>
  );
};

const SolutionColor: React.FC<MacroPhenomenonStageProps> = ({ event, progress, reducedMotion }) => {
  const { language } = useLanguage();
  const from = paramString(event, 'from', '#9f3e2e');
  const to = paramString(event, 'to', '#e8e8df');
  const fromLabel = paramString(event, 'fromLabel', from);
  const toLabel = paramString(event, 'toLabel', to);
  const visualProgress = getMacroVisualProgress(event, progress);
  const fill = interpolateColor(from, to, visualProgress);
  const currentLabel = visualProgress < 0.5 ? fromLabel : toLabel;
  const localizedLabel = language === 'zh'
    ? ({ clear: '无色', pink: '酚酞变红' }[currentLabel] ?? currentLabel)
    : currentLabel;
  return (
    <div className="absolute inset-3 flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-slate-950/15">
      <div className="relative h-32 w-40 rounded-b-[2rem] border-x-4 border-b-4 border-white/50 bg-white/10 p-2">
        <div className="absolute inset-x-2 bottom-2 top-5 rounded-b-[1.55rem] transition-colors duration-200" style={{ backgroundColor: fill, opacity: reducedMotion ? 0.78 : 0.62 + visualProgress * 0.25 }} />
        <div className="absolute left-1/2 top-1 h-2 w-20 -translate-x-1/2 rounded-full bg-white/50" />
      </div>
      <div className="mt-3 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold text-white/85" aria-live="polite">
        {localizedLabel}
      </div>
      {event.params.conditionNote && typeof event.params.conditionNote === 'string' && (
        <p className="mt-2 max-w-[250px] text-center text-[10px] leading-relaxed text-white/65">{event.params.conditionNote}</p>
      )}
    </div>
  );
};

const SolidHydration: React.FC<MacroPhenomenonStageProps> = ({ event, progress, reducedMotion }) => {
  const expansion = reducedMotion ? 1 : 0.9 + progress * 0.25;
  const fragmentColor = paramString(event, 'fromColor', '#f4f0e8');
  const productColor = paramString(event, 'toColor', '#fffdf6');
  return (
    <div className="absolute inset-3 overflow-hidden rounded-2xl border border-amber-100/25 bg-gradient-to-b from-slate-950/15 to-amber-100/10">
      <div className="absolute inset-x-[14%] bottom-[18%] h-[13%] rounded-full bg-cyan-100/20" />
      <div className="absolute left-[21%] top-[30%] h-7 w-7 rotate-12 rounded-md" style={{ backgroundColor: fragmentColor, opacity: 0.8 }} />
      <div className="absolute left-[37%] top-[38%] h-6 w-8 -rotate-12 rounded-md" style={{ backgroundColor: fragmentColor, opacity: 0.8 }} />
      <div className="absolute right-[28%] top-[28%] h-8 w-6 rotate-45 rounded-md" style={{ backgroundColor: productColor, opacity: 0.78 + progress * 0.2, transform: `scale(${expansion}) rotate(45deg)` }} />
      <div className="absolute bottom-[21%] left-1/2 h-12 w-32 -translate-x-1/2 rounded-full border border-white/20 bg-white/15" style={{ opacity: 0.22 + progress * 0.5 }} />
    </div>
  );
};

const HeatRise: React.FC<MacroPhenomenonStageProps> = ({ event, progress, reducedMotion }) => {
  const measured = paramNumber(event, ['measuredTemperature', 'temperature']);
  const cue = paramString(event, 'cue', '温度上升');
  return (
    <div className="absolute inset-3 flex items-center justify-center overflow-hidden rounded-2xl border border-orange-200/20 bg-gradient-to-b from-slate-950/20 to-orange-950/20">
      <div className="relative h-32 w-8 rounded-full border-2 border-white/45 bg-white/10 p-1">
        <div className="absolute bottom-1 left-1 right-1 rounded-full bg-orange-300/85 transition-[height] duration-200" style={{ height: `${20 + progress * 66}%` }} />
        <div className="absolute -bottom-3 left-1/2 h-5 w-5 -translate-x-1/2 rounded-full bg-orange-300/85" />
      </div>
      <div className="ml-5 flex min-w-0 flex-col gap-1 text-center">
        <span className="whitespace-nowrap text-base font-bold text-orange-100">{measured === undefined ? '温度上升' : `${measured}°C`}</span>
        <span className="text-xs text-white/65">{cue}</span>
      </div>
      <div className="pointer-events-none absolute inset-y-8 right-10 w-12 rounded-full border-l-2 border-orange-200/30" style={{ opacity: reducedMotion ? 0.35 : 0.2 + progress * 0.5 }} />
    </div>
  );
};

export const MacroPhenomenonStage: React.FC<MacroPhenomenonStageProps> = (props) => {
  const { language } = useLanguage();
  const label = props.event.label[language];
  const note = language === 'zh'
    ? '教学示意，非真实比例或速率'
    : 'Teaching illustration, not real scale or rate';
  let content: React.ReactNode;
  switch (props.event.kind) {
    case 'metal-on-water':
      content = <MetalOnWater {...props} />;
      break;
    case 'flame':
      content = <Flame {...props} />;
      break;
    case 'smoke':
      content = <Smoke {...props} />;
      break;
    case 'solution-color':
      content = <SolutionColor {...props} />;
      break;
    case 'solid-hydration':
      content = <SolidHydration {...props} />;
      break;
    case 'heat-rise':
      content = <HeatRise {...props} />;
      break;
  }
  return (
    <section
      className="relative flex min-h-[220px] h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#132027] text-white"
      data-macro-kind={props.event.kind}
      aria-label={label}
    >
      <header className="relative z-10 flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-semibold text-[#8fe8dc]">{language === 'zh' ? '宏观现象' : 'Macroscopic view'}</span>
        <span className="min-w-0 truncate text-xs font-semibold text-white/80">{label}</span>
      </header>
      <div className="relative min-h-0 flex-1">{content}</div>
      <p className="relative z-10 border-t border-white/10 bg-black/10 px-3 py-2 text-[10px] leading-relaxed text-white/55">{note}</p>
    </section>
  );
};
