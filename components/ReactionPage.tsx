import React from 'react';
import { CuratedReaction } from '../src/data/reactions/schema';
import { Molecule3DViewer } from './Molecule3DViewer';
import { AtomInsightPanel } from './AtomInsightPanel';
import { PresentationMode } from './PresentationMode';
import { QrShare } from './QrShare';
import { updateRouteParams } from '../utils/routeParams';
import { trackEvent } from '../services/geminiService';
import { ArrowLeft, Presentation as PresentationIcon, GraduationCap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { parseChapter } from '../utils/textbook';

interface ReactionPageProps {
  reaction: CuratedReaction;
  present: boolean;
  onExit: () => void;
}

export const ReactionPage: React.FC<ReactionPageProps> = ({ reaction, present, onExit }) => {
  const { t, language } = useLanguage();
  const [selectedAtomId, setSelectedAtomId] = React.useState<number | null>(null);
  const [activeStepIdx, setActiveStepIdx] = React.useState<number | null>(null);
  React.useEffect(() => {
    trackEvent('textbook', reaction.id);
    setSelectedAtomId(null);
    setActiveStepIdx(null);
  }, [reaction.id]);
  if (present) {
    return (
      <PresentationMode
        equation={reaction.equation}
        conditions={reaction.conditions}
        title={reaction.title}
        steps={reaction.mechanismSteps}
        structure={reaction.productStructure}
        highlightSteps={reaction.stepAtomIds}
        atomInsights={reaction.atomInsights}
        reactionFlow={reaction.reactionFlow}
        onClose={() => updateRouteParams({ mode: null })}
      />
    );
  }
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:h-full lg:overflow-y-auto">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#f0ece4] text-[#5c5549] hover:bg-[#e8d5b8] transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> {t('backBtn')}
          </button>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-science-50 text-science-700 border border-science-200">
              <GraduationCap className="w-3 h-3" />
              {parseChapter(reaction.chapter).volumeLabel[language]}
              {parseChapter(reaction.chapter).grade[language] ? ` · ${parseChapter(reaction.chapter).grade[language]}` : ''}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f0e8] text-[#866027] border border-[#e8d5b8]">
              {reaction.chapter}
            </span>
          </div>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold font-display text-[#1a1a1a] mb-3">{reaction.title}</h2>
        <div className="p-4 bg-science-50 rounded-xl border border-science-200 font-mono text-base sm:text-lg text-science-800 break-words mb-3">
          {reaction.equation}
        </div>
        <p className="text-sm text-[#5c5549] mb-4">
          <span className="font-semibold">{t('conditionsLabel')}:</span> {reaction.conditions || '—'}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => updateRouteParams({ mode: 'present' })}
            className="px-5 py-2.5 rounded-lg font-semibold text-white shadow-md bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 transition-all flex items-center gap-2"
          >
            <PresentationIcon className="w-4 h-4" /> {t('demoBtn')}
          </button>
          <QrShare />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
          <h3 className="text-lg font-semibold text-[#1a1a1a] mb-3">{t('mechanismLabel')}</h3>
          <ol className="space-y-2 text-sm text-[#5c5549]">
            {reaction.mechanismSteps.map((step, i) => {
              const active = activeStepIdx === i;
              const highlightable = Boolean(reaction.stepAtomIds?.[i]?.length);
              return (
                <li key={i}>
                  <button
                    onClick={() => {
                      setSelectedAtomId(null);
                      setActiveStepIdx(active ? null : i);
                    }}
                    className={`w-full text-left rounded-lg px-3 py-2 border-l-4 transition-colors ${
                      active
                        ? 'border-science-500 bg-science-50 text-science-900'
                        : highlightable
                          ? 'border-transparent hover:bg-[#faf8f5]'
                          : 'border-transparent cursor-default'
                    }`}
                  >
                    <span className="font-mono text-xs text-[#a39a89] mr-1.5">{i + 1}.</span>
                    {step}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            {reaction.products.map((p, i) => (
              <span key={i} className="px-3 py-1 bg-[#f5f0e8] border border-[#e8d5b8] rounded-full text-sm text-[#1a1a1a]">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="relative min-h-[360px] bg-white rounded-2xl shadow-lg border border-[#f0ece4] overflow-hidden">
          {reaction.productStructure ? (
            <>
              <Molecule3DViewer
                structure={reaction.productStructure}
                selectedAtomId={selectedAtomId}
                onAtomSelect={setSelectedAtomId}
                highlightAtomIds={
                  activeStepIdx !== null && reaction.stepAtomIds
                    ? reaction.stepAtomIds[activeStepIdx]
                    : selectedAtomId !== null
                      ? [selectedAtomId]
                      : undefined
                }
              />
              {selectedAtomId !== null && (() => {
                const atom = reaction.productStructure!.atoms.find((a) => a.id === selectedAtomId);
                if (!atom) return null;
                return (
                  <AtomInsightPanel
                    insight={reaction.atomInsights?.[String(selectedAtomId)]}
                    element={atom.element}
                    onClose={() => setSelectedAtomId(null)}
                  />
                );
              })()}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-[#6f685d] text-sm">
              {t('noStructureMsg')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
