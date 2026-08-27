import React, { useEffect, useState } from 'react';
import { MoleculeStructure } from '../types';
import { AtomInsight } from '../src/data/reactions/schema';
import { MechanismMolecule } from './MechanismMolecule';
import { ReactionAnimationPlayer, type ReactionAnimationPlayerHandle } from './ReactionAnimationPlayer';
import { FlagshipReactionPlayer, type FlagshipReactionPlayerHandle } from './FlagshipReactionPlayer';
import type { CuratedReaction } from '../src/data/reactions/schema';
import type { ReactionAnimationScene } from '../src/data/reactions/schema';
import { AtomInsightPanel } from './AtomInsightPanel';
import { ChevronLeft, ChevronRight, Minimize2, Play, Undo2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { getEquationParts } from '../utils/reactionAnimation';
import type { AnimationSnapshot } from '../utils/reactionAnimation';
import { isFlagshipReactionScene } from '../utils/flagshipReaction';

interface PresentationModeProps {
  equation: string;
  conditions: string;
  title: string;
  steps: string[];
  structure: MoleculeStructure | null;
  /** 每步对应的原子 id（与 steps 平行；缺省步不高亮） */
  highlightSteps?: number[][];
  /** 原子级 AI 讲解（演示模式下点击原子同样弹出） */
  atomInsights?: Record<string, AtomInsight>;
  /** 全程反应动画数据（精选反应才有） */
  reactionFlow?: CuratedReaction['reactionFlow'];
  /** 分段教学时间轴；旧条目缺省时仍保留原有机理编舞。 */
  reactionAnimation?: ReactionAnimationScene;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  equation,
  conditions,
  title,
  steps,
  structure,
  highlightSteps,
  atomInsights,
  reactionFlow,
  reactionAnimation,
  onClose,
}) => {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAtomId, setSelectedAtomId] = useState<number | null>(null);
  const [flowPlaying, setFlowPlaying] = useState(false);
  const [flowSnapshot, setFlowSnapshot] = useState<AnimationSnapshot | null>(null);
  const flowPlayerRef = React.useRef<ReactionAnimationPlayerHandle>(null);
  const flagshipPlayerRef = React.useRef<FlagshipReactionPlayerHandle>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const equationParts = React.useMemo(() => getEquationParts(equation), [equation]);

  const seekFlowStep = (next: number) => {
    if (isFlagshipReactionScene(reactionAnimation)) flagshipPlayerRef.current?.seekToStep(next);
    else flowPlayerRef.current?.seekToStep(next);
  };

  React.useLayoutEffect(() => {
    if (flowPlaying) bodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [flowPlaying]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInteractive = Boolean(target && (
        target.isContentEditable
        || ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target.tagName)
      ));
      if (isInteractive && event.key !== 'Escape') return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        setStepIndex((prev) => {
          const next = Math.min(prev + 1, steps.length - 1);
          if (flowPlaying) seekFlowStep(next);
          return next;
        });
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        setStepIndex((prev) => {
          const next = Math.max(prev - 1, 0);
          if (flowPlaying) seekFlowStep(next);
          return next;
        });
      } else if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'f' || event.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flowPlaying, steps.length, onClose]);

  const equationFocus = flowSnapshot?.stage.equationFocus;

  return (
    <div className="fixed inset-0 z-[100] bg-[#101418] text-white flex flex-col select-none">
      {/* Top bar */}
      <header className="flex items-start justify-between gap-4 px-8 pt-6 pb-4">
        <div className="min-w-0">
          <div className="font-mono text-3xl md:text-5xl font-bold tracking-tight break-words">
            <span className={equationFocus === 'reactants' ? 'rounded-md bg-[#ffbf69]/20 px-2 py-1 text-[#ffe0a5]' : 'text-white/85'}>{equationParts.reactants}</span>
            {equationParts.arrow && <span className={equationFocus === 'change' ? 'mx-2 rounded-md bg-[#ffbf69]/25 px-2 py-1 text-[#ffd28f]' : 'mx-2 text-white/45'}>{equationParts.arrow}</span>}
            {equationParts.products && <span className={equationFocus === 'products' ? 'rounded-md bg-[#8fe8dc]/15 px-2 py-1 text-[#d4fff6]' : 'text-white/85'}>{equationParts.products}</span>}
          </div>
          <div className="mt-2 text-base md:text-xl text-white/60">
            {title}
            {conditions ? ` · ${conditions}` : ''}
          </div>
        </div>
        <button
          onClick={onClose}
          title="Esc"
          className="shrink-0 p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Minimize2 className="w-6 h-6" />
        </button>
      </header>

      {/* Body */}
      <div ref={bodyRef} className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 px-8 pb-8 overflow-y-auto md:overflow-hidden">
        {/* Mechanism steps */}
        <div className={`md:w-[45%] flex flex-col justify-center gap-4 min-w-0 ${flowPlaying ? 'order-2 md:order-1' : ''}`}>
          {steps.map((step, i) => {
            const active = i === stepIndex;
            return (
              <button
                key={i}
                onClick={() => {
                  setStepIndex(i);
                  if (flowPlaying) seekFlowStep(i);
                }}
                className={`text-left rounded-2xl px-6 py-5 transition-all duration-300 ${
                  active
                    ? 'bg-white/15 scale-[1.03] shadow-xl'
                    : 'bg-transparent text-white/40 hover:text-white/70'
                }`}
              >
                <span
                  className={`block ${active ? 'text-2xl md:text-3xl font-semibold text-white' : ''}`}
                >
                  {step}
                </span>
              </button>
            );
          })}
        </div>

        {/* Structure：机理编舞场景 */}
        {structure && (
          <div className={`relative md:w-[55%] min-h-[560px] md:min-h-0 rounded-3xl overflow-hidden bg-black/30 ${flowPlaying ? 'order-1 md:order-2' : ''}`}>
            {flowPlaying && reactionFlow && reactionAnimation ? (
              isFlagshipReactionScene(reactionAnimation) ? (
                <FlagshipReactionPlayer
                  ref={flagshipPlayerRef}
                  equation={equation}
                  steps={steps}
                  structure={structure}
                  flow={reactionFlow}
                  scene={reactionAnimation}
                  compact
                  selectedAtomId={selectedAtomId}
                  onAtomSelect={setSelectedAtomId}
                  autoPlay
                  onStageChange={(snapshot) => {
                    setFlowSnapshot(snapshot);
                    setStepIndex(snapshot.stage.stepIndex);
                  }}
                />
              ) : (
                <ReactionAnimationPlayer
                  ref={flowPlayerRef}
                  equation={equation}
                  steps={steps}
                  structure={structure}
                  flow={reactionFlow}
                  animation={reactionAnimation}
                  compact
                  selectedAtomId={selectedAtomId}
                  onAtomSelect={setSelectedAtomId}
                  autoPlay
                  onStageChange={(snapshot) => {
                    setFlowSnapshot(snapshot);
                    setStepIndex(snapshot.stage.stepIndex);
                  }}
                />
              )
            ) : (
              <MechanismMolecule
                structure={structure}
                stepAtomIds={highlightSteps}
                stepIndex={stepIndex}
                selectedAtomId={selectedAtomId}
                onAtomSelect={setSelectedAtomId}
              />
            )}
            {reactionFlow && reactionAnimation && !flowPlaying && (
              <div className="absolute right-3 top-3 z-20 flex gap-2">
                <button
                  onClick={() => {
                    setSelectedAtomId(null);
                    setFlowSnapshot(null);
                    setFlowPlaying(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-amber-500/40 transition-all hover:scale-105 hover:from-amber-400 hover:to-orange-400"
                >
                  <Play className="h-4 w-4" /> {t('flowPlayBtn')}
                </button>
              </div>
            )}
            {reactionFlow && reactionAnimation && flowPlaying && (
              <button
                onClick={() => {
                  setSelectedAtomId(null);
                  setFlowSnapshot(null);
                  setFlowPlaying(false);
                }}
                className="absolute right-3 top-3 z-30 flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#101820]/80 px-3 py-1.5 text-xs text-white shadow-md backdrop-blur-sm transition-colors hover:bg-[#101820]"
              >
                <Undo2 className="h-3 w-3" /> {t('flowBackBtn')}
              </button>
            )}
            {selectedAtomId !== null && (() => {
              const atom = structure.atoms.find((a) => a.id === selectedAtomId);
              if (!atom) return null;
              return (
                <AtomInsightPanel
                  insight={atomInsights?.[String(selectedAtomId)]}
                  element={atom.element}
                  onClose={() => setSelectedAtomId(null)}
                />
              );
            })()}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <footer className="flex items-center justify-between px-8 pb-6 pt-2 text-white/70">
        <button
          onClick={() => setStepIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            if (flowPlaying) seekFlowStep(next);
            return next;
          })}
          disabled={stepIndex === 0}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="font-mono text-xl">
          {stepIndex + 1} / {steps.length}
        </div>
        <button
          onClick={() => setStepIndex((prev) => {
            const next = Math.min(prev + 1, steps.length - 1);
            if (flowPlaying) seekFlowStep(next);
            return next;
          })}
          disabled={stepIndex === steps.length - 1}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </footer>
    </div>
  );
};
