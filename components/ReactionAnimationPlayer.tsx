import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import type { MoleculeStructure } from '../types';
import type {
  CuratedReaction,
  ReactionAnimationScene,
} from '../src/data/reactions/schema';
import {
  getAnimationSnapshot,
  getEquationParts,
  getStepNavigationState,
  type AnimationSnapshot,
} from '../utils/reactionAnimation';
import { useLanguage } from '../contexts/LanguageContext';
import { ReactionFlowScene } from './ReactionFlowScene';

export interface ReactionAnimationPlayerHandle {
  seekToStep: (stepIndex: number) => void;
  replay: () => void;
  togglePlayback: () => void;
}

interface ReactionAnimationPlayerProps {
  equation: string;
  steps: string[];
  structure: MoleculeStructure;
  flow: NonNullable<CuratedReaction['reactionFlow']>;
  animation: ReactionAnimationScene;
  selectedAtomId?: number | null;
  onAtomSelect?: (id: number | null) => void;
  onStageChange?: (snapshot: AnimationSnapshot) => void;
  autoPlay?: boolean;
  /** 演示模式可用的窄高布局，确保控制条在 720px 高窗口内可见。 */
  compact?: boolean;
}

const SPEEDS = [0.5, 1, 1.5] as const;

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60).toString().padStart(2, '0');
  const remainder = (whole % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

const EquationProgress: React.FC<{
  equation: string;
  focus: AnimationSnapshot['stage']['equationFocus'];
}> = ({ equation, focus }) => {
  const parts = useMemo(() => getEquationParts(equation), [equation]);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm leading-relaxed text-[#f3efe6] sm:text-base" aria-label={equation}>
      <span className={`rounded-md px-1.5 py-0.5 transition-colors ${focus === 'reactants' ? 'bg-[#d7b56d]/20 text-[#ffe0a5]' : 'text-white/60'}`}>
        {parts.reactants}
      </span>
      {parts.arrow && (
        <span className={`transition-colors ${focus === 'change' ? 'text-[#ffbf69]' : 'text-white/40'}`}>
          {parts.arrow}
        </span>
      )}
      {parts.products && (
        <span className={`rounded-md px-1.5 py-0.5 transition-colors ${focus === 'products' ? 'bg-[#8fe8dc]/15 text-[#c4fff3]' : 'text-white/60'}`}>
          {parts.products}
        </span>
      )}
      {focus === 'observation' && (
        <span className="rounded-md border border-[#ffbf69]/30 px-1.5 py-0.5 text-[11px] font-sans text-[#ffcf8a]">
          observation
        </span>
      )}
    </div>
  );
};

export const ReactionAnimationPlayer = forwardRef<ReactionAnimationPlayerHandle, ReactionAnimationPlayerProps>(
  function ReactionAnimationPlayer(
    {
      equation,
      steps,
      structure,
      flow,
      animation,
      selectedAtomId = null,
      onAtomSelect,
      onStageChange,
      autoPlay = true,
      compact = false,
    },
    ref,
  ) {
    const { t, language } = useLanguage();
    const reduced = useMemo(
      () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
      [],
    );
    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(autoPlay && !reduced);
    const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
    const snapshot = useMemo(() => getAnimationSnapshot(animation, time), [animation, time]);
    const changeHandlerRef = useRef(onStageChange);
    changeHandlerRef.current = onStageChange;

    useEffect(() => {
      if (!playing) return undefined;
      let frame = 0;
      let previous = performance.now();
      const tick = (now: number) => {
        const delta = Math.min(0.08, Math.max(0, (now - previous) / 1000));
        previous = now;
        setTime((current) => Math.min(animation.duration, current + delta * speed));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, [animation.duration, playing, speed]);

    useEffect(() => {
      if (playing && time >= animation.duration) setPlaying(false);
    }, [animation.duration, playing, time]);

    useEffect(() => {
      changeHandlerRef.current?.(snapshot);
    }, [snapshot.stage.id]);

    useImperativeHandle(ref, () => ({
      seekToStep: (stepIndex) => {
        const next = getStepNavigationState(animation, stepIndex);
        setTime(next.time);
        setPlaying(next.playing);
      },
      replay: () => {
        setTime(0);
        setPlaying(true);
      },
      togglePlayback: () => setPlaying((current) => !current && time < animation.duration),
    }), [animation, time]);

    const handleScrub = (event: React.ChangeEvent<HTMLInputElement>) => {
      setTime(Number(event.target.value));
      setPlaying(false);
    };
    const currentStage = snapshot.stage;
    const isComplete = time >= animation.duration;

    return (
      <section className={`flex h-full flex-col overflow-hidden rounded-[1.45rem] border border-[#284148] bg-[#101820] text-white shadow-[0_24px_65px_rgba(16,24,32,0.22)] ${compact ? 'min-h-0' : 'min-h-[560px]'}`} aria-label={t('flowTimelineLabel')}>
        <header className="border-b border-white/10 bg-[radial-gradient(circle_at_88%_0%,rgba(104,185,190,0.18),transparent_38%),linear-gradient(135deg,#14242b,#101820)] px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#92d4ce]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffbf69] shadow-[0_0_10px_#ffbf69]" />
                {language === 'zh' ? '全程反应 · 教学编排' : 'Full reaction · teaching choreography'}
              </div>
              <EquationProgress equation={equation} focus={currentStage.equationFocus} />
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] text-white/55">
              {formatTime(time)} / {formatTime(animation.duration)}
            </span>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#8fe8dc]/15 bg-[#8fe8dc]/[0.06] px-3 py-2">
            <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8fe8dc]">{t('flowStageLabel')}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#f8f1e5]">{currentStage.label[language]}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-white/60">{currentStage.status[language]}</div>
            </div>
          </div>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {t('flowStatusLabel')}: {currentStage.status[language]}
          </div>
        </header>

        <div className={`relative flex-1 bg-[#111b20] ${compact ? 'min-h-[175px]' : 'min-h-[310px]'}`}>
          <ReactionFlowScene
            structure={structure}
            flow={flow}
            animation={animation}
            time={time}
            selectedAtomId={selectedAtomId}
            onAtomSelect={onAtomSelect}
          />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/10 bg-[#0b1318]/70 px-2 py-1 text-[10px] uppercase tracking-[0.13em] text-white/45 backdrop-blur-sm">
            {animation.family}
          </div>
        </div>

        <footer className="border-t border-white/10 bg-[#0d151b] px-4 pb-4 pt-3 sm:px-5">
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" aria-label={t('flowTimelineLabel')}>
            {animation.stages.map((stage, index) => {
              const active = stage.id === currentStage.id;
              const completed = time >= stage.end;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => {
                    const next = getStepNavigationState(animation, stage.stepIndex);
                    setTime(next.time);
                    setPlaying(next.playing);
                  }}
                  aria-current={active ? 'step' : undefined}
                  aria-label={`${index + 1}. ${stage.label[language]}`}
                  title={steps[stage.stepIndex]}
                  className={`relative min-w-[104px] flex-1 rounded-lg border px-2 py-2 text-left transition-colors ${active ? 'border-[#ffbf69]/70 bg-[#ffbf69]/12 text-[#ffe0a5]' : completed ? 'border-[#8fe8dc]/25 bg-[#8fe8dc]/[0.06] text-[#c5eee7]' : 'border-white/10 bg-white/[0.025] text-white/45 hover:border-white/25 hover:text-white/80'}`}
                >
                  <span className="block font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{String(index + 1).padStart(2, '0')}</span>
                  <span className="mt-1 block truncate text-[11px] font-semibold">{stage.label[language]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-white/45">{formatTime(time)}</span>
            <input
              type="range"
              min={0}
              max={animation.duration}
              step={0.01}
              value={time}
              onChange={handleScrub}
              aria-label={t('flowTimelineLabel')}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#ffbf69]"
            />
            <span className="font-mono text-[10px] text-white/45">{formatTime(animation.duration)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const next = getStepNavigationState(animation, Math.max(0, currentStage.stepIndex - 1));
                  setTime(next.time);
                  setPlaying(next.playing);
                }}
                aria-label={t('flowStepBackBtn')}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
                disabled={snapshot.stageIndex === 0}
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isComplete) {
                    setTime(0);
                    setPlaying(true);
                  } else {
                    setPlaying((current) => !current);
                  }
                }}
                aria-label={playing ? t('flowPauseBtn') : isComplete ? t('flowReplayBtn') : t('flowResumeBtn')}
                className="flex items-center gap-2 rounded-lg bg-[#ffbf69] px-3 py-2 text-xs font-bold text-[#25190d] shadow-[0_5px_18px_rgba(255,191,105,0.2)] transition-transform hover:-translate-y-0.5"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? t('flowPauseBtn') : isComplete ? t('flowReplayBtn') : t('flowResumeBtn')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextStep = Math.min(animation.stages.length - 1, currentStage.stepIndex + 1);
                  const next = getStepNavigationState(animation, nextStep);
                  setTime(next.time);
                  setPlaying(next.playing);
                }}
                aria-label={t('flowStepForwardBtn')}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
                disabled={snapshot.stageIndex === animation.stages.length - 1}
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTime(0);
                  setPlaying(true);
                }}
                aria-label={t('flowReplayBtn')}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-white/50">
              <span className="font-semibold uppercase tracking-[0.12em]">{t('flowSpeedLabel')}</span>
              <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                {SPEEDS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSpeed(value)}
                    aria-pressed={speed === value}
                    className={`rounded-md px-2 py-1 font-mono transition-colors ${speed === value ? 'bg-white/15 text-[#ffe0a5]' : 'text-white/45 hover:text-white/80'}`}
                  >
                    {value}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </footer>
      </section>
    );
  },
);
