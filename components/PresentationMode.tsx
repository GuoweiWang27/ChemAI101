import React, { useEffect, useState } from 'react';
import { MoleculeStructure } from '../types';
import { AtomInsight } from '../src/data/reactions/schema';
import { MechanismMolecule } from './MechanismMolecule';
import { ReactionFlowScene } from './ReactionFlowScene';
import type { CuratedReaction } from '../src/data/reactions/schema';
import { AtomInsightPanel } from './AtomInsightPanel';
import { ChevronLeft, ChevronRight, Minimize2, Play, RotateCcw, Undo2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

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
  onClose,
}) => {
  const { t } = useLanguage();
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedAtomId, setSelectedAtomId] = useState<number | null>(null);
  const [flowPlaying, setFlowPlaying] = useState(false);
  const [flowPlayKey, setFlowPlayKey] = useState(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        setStepIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'f' || event.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#101418] text-white flex flex-col select-none">
      <style>{'@keyframes chemai-pulse{0%{transform:scale(1)}40%{transform:scale(1.045)}100%{transform:scale(1)}}.chemai-pulse{animation:chemai-pulse 550ms ease}'}</style>
      {/* Top bar */}
      <header className="flex items-start justify-between gap-4 px-8 pt-6 pb-4">
        <div className="min-w-0">
          <div className="font-mono text-3xl md:text-5xl font-bold tracking-tight break-words">
            {equation}
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
      <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-6 px-8 pb-8 overflow-y-auto md:overflow-hidden">
        {/* Mechanism steps */}
        <div className="md:w-[45%] flex flex-col justify-center gap-4 min-w-0">
          {steps.map((step, i) => {
            const active = i === stepIndex;
            return (
              <button
                key={i}
                onClick={() => setStepIndex(i)}
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
          <div className="relative md:w-[55%] min-h-[240px] md:min-h-0 rounded-3xl overflow-hidden bg-black/30">
            {flowPlaying && reactionFlow ? (
              <ReactionFlowScene
                structure={structure}
                flow={reactionFlow}
                playKey={flowPlayKey}
                selectedAtomId={selectedAtomId}
                onAtomSelect={setSelectedAtomId}
              />
            ) : (
              <MechanismMolecule
                structure={structure}
                stepAtomIds={highlightSteps}
                stepIndex={stepIndex}
                selectedAtomId={selectedAtomId}
                onAtomSelect={setSelectedAtomId}
              />
            )}
            {reactionFlow && (
              <div className="absolute top-3 right-3 z-20 flex gap-2">
                {!flowPlaying ? (
                  <button
                    onClick={() => {
                      setSelectedAtomId(null);
                      setFlowPlayKey((k) => k + 1);
                      setFlowPlaying(true);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/40 transition-all hover:scale-105"
                  >
                    <Play className="w-4 h-4" /> {t('flowPlayBtn')}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedAtomId(null);
                        setFlowPlayKey((k) => k + 1);
                      }}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/25 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> {t('flowReplayBtn')}
                    </button>
                    <button
                      onClick={() => {
                        setSelectedAtomId(null);
                        setFlowPlaying(false);
                      }}
                      className="flex items-center gap-1.5 bg-white/10 hover:bg-white/25 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Undo2 className="w-3 h-3" /> {t('flowBackBtn')}
                    </button>
                  </>
                )}
              </div>
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
          onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
          disabled={stepIndex === 0}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="font-mono text-xl">
          {stepIndex + 1} / {steps.length}
        </div>
        <button
          onClick={() => setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))}
          disabled={stepIndex === steps.length - 1}
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </footer>
    </div>
  );
};
