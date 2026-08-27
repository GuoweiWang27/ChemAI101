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
  FlagshipTrackEvent,
  ReactionAnimationSceneV3,
} from '../src/data/reactions/schema';
import {
  getAnimationSnapshot,
  getEquationParts,
  getStepNavigationState,
  type AnimationSnapshot,
} from '../utils/reactionAnimation';
import {
  advanceFlagshipPlayback,
  getFlagshipStageReplayRange,
  getFlagshipStageReplayStopTime,
  resolvePlaybackEndOnResume,
} from '../utils/flagshipReaction';
import { useLanguage } from '../contexts/LanguageContext';
import { MacroPhenomenonStage } from './MacroPhenomenonStage';
import { ReactionFlowScene } from './ReactionFlowScene';
import { TeachingMomentCard } from './TeachingMomentCard';
import { FlagshipMicroStage } from './FlagshipMicroStage';

export interface FlagshipReactionPlayerHandle {
  seekToStep: (stepIndex: number) => void;
  replay: () => void;
  togglePlayback: () => void;
  replayStage: (stageId: string) => void;
}

export interface FlagshipReactionPlayerProps {
  equation: string;
  steps: string[];
  structure: MoleculeStructure;
  flow: NonNullable<CuratedReaction['reactionFlow']>;
  scene: ReactionAnimationSceneV3;
  selectedAtomId?: number | null;
  onAtomSelect?: (id: number | null) => void;
  onStageChange?: (snapshot: AnimationSnapshot) => void;
  autoPlay?: boolean;
  compact?: boolean;
}

const SPEEDS = [0.5, 1, 1.5] as const;

function clamp(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function isTrackEventActive(
  event: Pick<FlagshipTrackEvent, 'at' | 'duration'>,
  time: number,
  duration: number,
): boolean {
  const terminal = event.at + event.duration >= duration && time === duration;
  return time >= event.at && (time < event.at + event.duration || terminal);
}

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60).toString().padStart(2, '0')}:${(whole % 60).toString().padStart(2, '0')}`;
}

const EquationCueBar: React.FC<{
  equation: string;
  focus: ReactionAnimationSceneV3['stages'][number]['equationFocus'];
  language: 'zh' | 'en';
  selectedAtom?: { id: number; element: string };
}> = ({ equation, focus, language, selectedAtom }) => {
  const parts = useMemo(() => getEquationParts(equation), [equation]);
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm leading-relaxed text-[#f3efe6] sm:text-base" aria-label={equation}>
      <span className={`rounded-md px-1.5 py-0.5 transition-colors ${focus === 'reactants' ? 'bg-[#d7b56d]/25 text-[#ffe0a5]' : 'text-white/70'}`}>
        {parts.reactants}
      </span>
      {parts.arrow && (
        <span className={`transition-colors ${focus === 'change' ? 'text-[#ffbf69]' : 'text-white/45'}`}>
          {parts.arrow}
        </span>
      )}
      {parts.products && (
        <span className={`rounded-md px-1.5 py-0.5 transition-colors ${focus === 'products' ? 'bg-[#8fe8dc]/20 text-[#c4fff3]' : 'text-white/70'}`}>
          {parts.products}
        </span>
      )}
      {focus === 'observation' && (
        <span className="rounded-md border border-[#ffbf69]/35 px-1.5 py-0.5 text-[11px] font-sans text-[#ffcf8a]">
          {language === 'zh' ? '实验现象' : 'observation'}
        </span>
      )}
      {selectedAtom && (
        <span className="rounded-md border border-[#8fe8dc]/35 bg-[#8fe8dc]/10 px-2 py-0.5 text-[11px] font-sans text-[#d6fff4]" aria-label={language === 'zh' ? '当前观察原子' : 'Currently observed atom'}>
          {language === 'zh' ? '当前观察原子' : 'Observed atom'}: {selectedAtom.element} #{selectedAtom.id}
        </span>
      )}
    </div>
  );
};

export const FlagshipReactionPlayer = forwardRef<FlagshipReactionPlayerHandle, FlagshipReactionPlayerProps>(
  function FlagshipReactionPlayer(
    {
      equation,
      steps,
      structure,
      flow,
      scene,
      selectedAtomId: selectedAtomIdProp = null,
      onAtomSelect,
      onStageChange,
      autoPlay = true,
      compact = false,
    },
    ref,
  ) {
    const { language } = useLanguage();
    const reducedMotion = useMemo(
      () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
      [],
    );
    const [time, setTime] = useState(0);
    const [playing, setPlaying] = useState(autoPlay && !reducedMotion);
    const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
    const [mobileTrack, setMobileTrack] = useState<'macro' | 'micro'>('macro');
    const [autoPause, setAutoPause] = useState(false);
    const [expandedMomentId, setExpandedMomentId] = useState<string | null>(null);
    const [selectedAtomId, setSelectedAtomId] = useState<number | null>(selectedAtomIdProp);
    const consumedMomentIds = useRef<Set<string>>(new Set());
    const previousTime = useRef(0);
    const playbackEnd = useRef(scene.duration);
    const previousSelectedAtomIdProp = useRef(selectedAtomIdProp);
    const lastNotifiedStageId = useRef<string | null>(null);
    const changeHandlerRef = useRef(onStageChange);
    changeHandlerRef.current = onStageChange;

    useEffect(() => {
      if (previousSelectedAtomIdProp.current === selectedAtomIdProp) return;
      previousSelectedAtomIdProp.current = selectedAtomIdProp;
      setSelectedAtomId(selectedAtomIdProp);
    }, [selectedAtomIdProp]);

    useEffect(() => {
      if (!playing) return undefined;
      let frame = 0;
      let previous = performance.now();
      const tick = (now: number) => {
        const delta = Math.min(0.08, Math.max(0, (now - previous) / 1000));
        previous = now;
        setTime((current) => advanceFlagshipPlayback(current, delta, speed, playbackEnd.current));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }, [playing, scene.duration, speed]);

    const snapshot = useMemo(() => getAnimationSnapshot(scene, time), [scene, time]);
    const activeMacro = useMemo(
      () => scene.macroTrack.find((event) => isTrackEventActive(event, time, scene.duration))
        ?? scene.macroTrack.find((event) => event.stageId === snapshot.stage.id)
        ?? scene.macroTrack[scene.macroTrack.length - 1],
      [scene, snapshot.stage.id, time],
    );
    const activeEquation = useMemo(
      () => scene.equationTrack.find((event) => isTrackEventActive(event, time, scene.duration))
        ?? scene.equationTrack.find((event) => event.stageId === snapshot.stage.id)
        ?? scene.equationTrack[scene.equationTrack.length - 1],
      [scene, snapshot.stage.id, time],
    );
    const activeMicro = useMemo(
      () => scene.microTrack.find((event) => isTrackEventActive(event, time, scene.duration))
        ?? scene.microTrack.find((event) => event.stageId === snapshot.stage.id)
        ?? scene.microTrack[scene.microTrack.length - 1],
      [scene, snapshot.stage.id, time],
    );
    const currentMoment = useMemo(
      () => scene.teachingMoments.find((moment) => moment.stageId === snapshot.stage.id),
      [scene.teachingMoments, snapshot.stage.id],
    );
    const selectedAtom = selectedAtomId === null
      ? undefined
      : structure.atoms.find((atom) => atom.id === selectedAtomId);

    useEffect(() => {
      if (playing && time >= playbackEnd.current) setPlaying(false);
    }, [playing, time]);

    useEffect(() => {
      if (lastNotifiedStageId.current === snapshot.stage.id) return;
      lastNotifiedStageId.current = snapshot.stage.id;
      changeHandlerRef.current?.(snapshot);
    }, [snapshot]);

    useEffect(() => {
      if (autoPause && playing) {
        const crossed = scene.teachingMoments.find((moment) => (
          !consumedMomentIds.current.has(moment.id)
          && previousTime.current < moment.at
          && time >= moment.at
        ));
        if (crossed) {
          consumedMomentIds.current.add(crossed.id);
          setPlaying(false);
          setExpandedMomentId(crossed.id);
        }
      }
      previousTime.current = time;
    }, [autoPause, playing, scene.teachingMoments, time]);

    const seek = (nextTime: number, shouldPlay = false) => {
      setTime(Math.min(scene.duration, Math.max(0, nextTime)));
      setPlaying(shouldPlay && !reducedMotion);
    };
    const seekToStage = (stageId: string, shouldPlay = false) => {
      const range = getFlagshipStageReplayRange(scene, stageId);
      const stopTime = getFlagshipStageReplayStopTime(scene, stageId);
      if (!range || stopTime === null) return;
      scene.teachingMoments.forEach((moment) => {
        if (moment.stageId === stageId) consumedMomentIds.current.delete(moment.id);
      });
      playbackEnd.current = stopTime;
      seek(range.start, shouldPlay);
    };

    const togglePlayback = () => {
      if (reducedMotion) return;
      setPlaying((current) => {
        if (current) return false;
        playbackEnd.current = resolvePlaybackEndOnResume(time, playbackEnd.current, scene.duration);
        return time < scene.duration;
      });
    };

    useImperativeHandle(ref, () => ({
      seekToStep: (stepIndex) => {
        const next = getStepNavigationState(scene, stepIndex);
        seek(next.time, false);
      },
      replay: () => {
        consumedMomentIds.current.clear();
        previousTime.current = 0;
        playbackEnd.current = scene.duration;
        seek(0, true);
      },
      togglePlayback,
      replayStage: (stageId) => seekToStage(stageId, true),
    }), [scene, time, reducedMotion]);

    const activateStage = (stageIndex: number, shouldPlay = false) => {
      const stage = scene.stages[Math.min(scene.stages.length - 1, Math.max(0, stageIndex))];
      if (stage) seekToStage(stage.id, shouldPlay);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
      const target = event.target as HTMLElement;
      const isInteractive = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target.tagName);
      if (event.key === ' ' && !isInteractive) {
        event.preventDefault();
        event.stopPropagation();
        togglePlayback();
      } else if (event.key === 'ArrowLeft' && !isInteractive) {
        event.preventDefault();
        event.stopPropagation();
        activateStage(snapshot.stageIndex - 1);
      } else if (event.key === 'ArrowRight' && !isInteractive) {
        event.preventDefault();
        event.stopPropagation();
        activateStage(snapshot.stageIndex + 1);
      }
    };

    const isComplete = time >= scene.duration;
    const macroProgress = activeMacro?.stageId === snapshot.stage.id ? snapshot.progress : clamp((time - (activeMacro?.at ?? 0)) / Math.max(0.001, activeMacro?.duration ?? 1));
    const focus = activeEquation?.kind ?? snapshot.stage.equationFocus;
    const microPanel = (
      <div className="relative flex min-h-[220px] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#284148] bg-[#111b20]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <span className="text-[11px] font-semibold text-[#8fe8dc]">{language === 'zh' ? '微观机理' : 'Microscopic view'}</span>
          <span className="truncate text-xs text-white/60">{activeMicro?.label[language]}</span>
        </div>
        <div className="relative min-h-[190px] flex-1">
          {typeof window === 'undefined' ? (
            <div className="grid h-full min-h-[190px] place-items-center px-4 text-center text-xs text-white/55">
              {language === 'zh' ? '微观粒子轨将在浏览器中渲染' : 'The microscopic particle track renders in the browser'}
            </div>
          ) : scene.actors.some((actor) => actor.id === 'sodium-bead') ? (
            <ReactionFlowScene
              structure={structure}
              flow={flow}
              animation={scene}
              time={time}
              selectedAtomId={selectedAtomId}
              onAtomSelect={(id) => {
                setSelectedAtomId(id);
                onAtomSelect?.(id);
              }}
            />
          ) : activeMicro ? (
            <FlagshipMicroStage
              event={activeMicro}
              progress={snapshot.progress}
              reducedMotion={reducedMotion}
            />
          ) : (
            <div className="grid h-full min-h-[190px] place-items-center px-4 text-center text-xs text-white/55">
              {language === 'zh' ? '当前阶段暂无微观模型' : 'No micro model for this stage'}
            </div>
          )}
        </div>
      </div>
    );

    return (
      <section
        className={`flex min-h-0 flex-col overflow-hidden rounded-[1.45rem] border border-[#284148] bg-[#101820] font-sans text-white shadow-[0_24px_65px_rgba(16,24,32,0.22)] lg:h-full ${compact ? 'min-h-0' : 'min-h-[600px]'}`}
        aria-label={language === 'zh' ? '旗舰反应课堂演示' : 'Flagship reaction classroom demonstration'}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <header className="border-b border-white/10 bg-[radial-gradient(circle_at_88%_0%,rgba(104,185,190,0.18),transparent_38%),linear-gradient(135deg,#14242b,#101820)] px-4 pb-3 pt-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#92d4ce]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ffbf69]" />
                <span>{language === 'zh' ? '课堂演示 · 同步双轨' : 'Classroom demo · synchronized tracks'}</span>
                <span className="rounded-full border border-[#ffbf69]/35 bg-[#ffbf69]/10 px-2 py-0.5 font-mono text-[#ffcf8a]">{scene.qualityLevel}</span>
              </div>
              <EquationCueBar equation={equation} focus={focus} language={language} selectedAtom={selectedAtom} />
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-2 py-1 font-mono text-[10px] text-white/55">
              {formatTime(time)} / {formatTime(scene.duration)}
            </span>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#8fe8dc]/15 bg-[#8fe8dc]/[0.06] px-3 py-2">
            <span className="mt-0.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8fe8dc]">{language === 'zh' ? '当前阶段' : 'Current stage'}</span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#f8f1e5]">{snapshot.stage.label[language]}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-white/60">{snapshot.stage.status[language]}</div>
            </div>
          </div>
        </header>

        <div className="border-b border-white/10 bg-[#0d151b] px-4 py-2 lg:hidden">
          <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1" role="tablist" aria-label={language === 'zh' ? '轨道切换' : 'Track switcher'}>
            {(['macro', 'micro'] as const).map((track) => (
              <button
                key={track}
                type="button"
                role="tab"
                aria-selected={mobileTrack === track}
                onClick={() => setMobileTrack(track)}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${mobileTrack === track ? 'bg-[#8fe8dc]/15 text-[#d6fff4]' : 'text-white/50 hover:text-white/80'}`}
              >
                {track === 'macro' ? (language === 'zh' ? '宏观现象' : 'Macro phenomenon') : (language === 'zh' ? '微观机理' : 'Microscopic mechanism')}
              </button>
            ))}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col gap-3 bg-[#111b20] p-3 sm:p-4 lg:grid lg:grid-cols-2 lg:gap-4">
          <div className={`${mobileTrack === 'macro' ? 'flex' : 'hidden'} min-h-[220px] min-w-0 flex-1 lg:flex`} role="tabpanel" aria-label={language === 'zh' ? '宏观现象' : 'Macro phenomenon'}>
            {activeMacro && <MacroPhenomenonStage event={activeMacro} progress={macroProgress} reducedMotion={reducedMotion} />}
          </div>
          <div className={`${mobileTrack === 'micro' ? 'flex' : 'hidden'} min-h-[220px] min-w-0 flex-1 lg:flex`} role="tabpanel" aria-label={language === 'zh' ? '微观机理' : 'Microscopic mechanism'}>
            {microPanel}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#0d151b] px-4 pb-4 pt-3 sm:px-5">
          <div
            data-layout="fitted-grid"
            className="mb-3 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${scene.stages.length}, minmax(0, 1fr))` }}
            aria-label={language === 'zh' ? '阶段时间轴' : 'Stage timeline'}
          >
            {scene.stages.map((stage, index) => {
              const active = stage.id === snapshot.stage.id;
              const completed = time >= stage.end;
              const moment = scene.teachingMoments.find((candidate) => candidate.stageId === stage.id);
              return (
                <div key={stage.id} className="relative min-w-0">
                  <button
                    type="button"
                    onClick={() => activateStage(index)}
                    aria-current={active ? 'step' : undefined}
                    aria-label={`${index + 1}. ${stage.label[language]}`}
                    className={`relative w-full min-w-0 rounded-lg border px-2 py-2 text-left transition-colors ${active ? 'border-[#ffbf69]/70 bg-[#ffbf69]/12 text-[#ffe0a5]' : completed ? 'border-[#8fe8dc]/25 bg-[#8fe8dc]/[0.06] text-[#c5eee7]' : 'border-white/10 bg-white/[0.025] text-white/45 hover:border-white/25 hover:text-white/80'}`}
                  >
                    <span className="block font-mono text-[9px] uppercase tracking-[0.15em] opacity-70">{String(index + 1).padStart(2, '0')}</span>
                    <span className="mt-1 block truncate text-[11px] font-semibold">{stage.label[language]}</span>
                  </button>
                  {moment && (
                    <button
                      type="button"
                      onClick={() => seek(moment.at, false)}
                      aria-label={language === 'zh' ? `${stage.label.zh}课堂暂停点` : `${stage.label.en} classroom pause point`}
                      data-target-size="24"
                      className="absolute right-0 top-0 z-10 grid h-6 w-6 place-items-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffbf69]"
                    >
                      <span className="h-2 w-2 rounded-full border border-[#ffbf69] bg-[#ffbf69]/70" aria-hidden="true" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-white/45">{formatTime(time)}</span>
            <input
              type="range"
              min={0}
              max={scene.duration}
              step={0.01}
              value={time}
              onChange={(event) => {
                playbackEnd.current = scene.duration;
                setTime(Number(event.target.value));
                setPlaying(false);
              }}
              aria-label={language === 'zh' ? '反应时间轴' : 'Reaction timeline'}
              className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#ffbf69]"
            />
            <span className="font-mono text-[10px] text-white/45">{formatTime(scene.duration)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => activateStage(snapshot.stageIndex - 1)}
                aria-label={language === 'zh' ? '上一阶段' : 'Previous stage'}
                disabled={snapshot.stageIndex === 0}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <SkipBack className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isComplete) {
                    consumedMomentIds.current.clear();
                    previousTime.current = 0;
                    playbackEnd.current = scene.duration;
                    seek(0, true);
                  } else {
                    togglePlayback();
                  }
                }}
                disabled={reducedMotion}
                aria-label={playing ? (language === 'zh' ? '暂停' : 'Pause') : isComplete ? (language === 'zh' ? '重播' : 'Replay') : (language === 'zh' ? '播放' : 'Play')}
                className="flex items-center gap-2 rounded-lg bg-[#ffbf69] px-3 py-2 text-xs font-bold text-[#25190d] shadow-[0_5px_18px_rgba(255,191,105,0.2)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {playing ? (language === 'zh' ? '暂停' : 'Pause') : isComplete ? (language === 'zh' ? '重播' : 'Replay') : (language === 'zh' ? '播放' : 'Play')}
              </button>
              <button
                type="button"
                onClick={() => activateStage(snapshot.stageIndex + 1)}
                aria-label={language === 'zh' ? '下一阶段' : 'Next stage'}
                disabled={snapshot.stageIndex === scene.stages.length - 1}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                <SkipForward className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => seekToStage(snapshot.stage.id, true)}
                aria-label={language === 'zh' ? '重播本阶段' : 'Replay current stage'}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{language === 'zh' ? '本阶段' : 'Stage'}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/50">
              <span className="font-semibold uppercase tracking-[0.12em]">{language === 'zh' ? '速度' : 'Speed'}</span>
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
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2 py-1.5 text-white/60">
                <input type="checkbox" checked={autoPause} onChange={(event) => setAutoPause(event.target.checked)} className="accent-[#ffbf69]" />
                {language === 'zh' ? '节点自动暂停' : 'Auto-pause at prompts'}
              </label>
            </div>
          </div>
          {currentMoment && (
            <div className="mt-3">
              <TeachingMomentCard
                moment={currentMoment}
                expanded={expandedMomentId === currentMoment.id}
                onToggle={() => setExpandedMomentId((current) => current === currentMoment.id ? null : currentMoment.id)}
                onReplayStage={() => seekToStage(currentMoment.stageId, true)}
              />
            </div>
          )}
        </div>
      </section>
    );
  },
);
