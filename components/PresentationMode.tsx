import React, { useEffect, useState } from 'react';
import { MoleculeStructure } from '../types';
import { Molecule3DViewer } from './Molecule3DViewer';
import { ChevronLeft, ChevronRight, Minimize2 } from 'lucide-react';

interface PresentationModeProps {
  equation: string;
  conditions: string;
  title: string;
  steps: string[];
  structure: MoleculeStructure | null;
  onClose: () => void;
}

export const PresentationMode: React.FC<PresentationModeProps> = ({
  equation,
  conditions,
  title,
  steps,
  structure,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

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

        {/* Structure */}
        {structure && (
          <div className="md:w-[55%] min-h-[240px] md:min-h-0 rounded-3xl overflow-hidden bg-black/30">
            <Molecule3DViewer structure={structure} />
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
