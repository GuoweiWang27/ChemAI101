import React from 'react';
import { Lightbulb, RotateCcw } from 'lucide-react';
import type { FlagshipTeachingMoment } from '../src/data/reactions/schema';
import { useLanguage } from '../contexts/LanguageContext';

export interface TeachingMomentCardProps {
  moment: FlagshipTeachingMoment;
  expanded: boolean;
  onToggle: () => void;
  onReplayStage: () => void;
}

export const TeachingMomentCard: React.FC<TeachingMomentCardProps> = ({
  moment,
  expanded,
  onToggle,
  onReplayStage,
}) => {
  const { language } = useLanguage();
  const hintId = `${moment.id}-hint`;
  return (
    <aside className="rounded-2xl border border-[#e8d5b8] bg-[#fffaf1] p-4 text-[#33291d] shadow-sm" aria-label={language === 'zh' ? '课堂暂停点' : 'Classroom pause point'}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-[#f0c66e]/30 p-2 text-[#8b5a17]" aria-hidden="true">
          <Lightbulb className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9b6a22]">{language === 'zh' ? '课堂暂停点' : 'Classroom pause point'}</div>
          <h3 className="mt-1 text-sm font-bold leading-relaxed">{moment.question[language]}</h3>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-controls={hintId}
          aria-expanded={expanded}
          className="rounded-lg border border-[#d8b779] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#7f571d] transition-colors hover:bg-white"
        >
          {expanded
            ? (language === 'zh' ? '收起提示' : 'Hide hint')
            : (language === 'zh' ? '展开提示' : 'Expand hint')}
        </button>
        <button
          type="button"
          onClick={onReplayStage}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8b779] bg-transparent px-3 py-1.5 text-xs font-semibold text-[#7f571d] transition-colors hover:bg-white/70"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {language === 'zh' ? '重播本阶段' : 'Replay this stage'}
        </button>
      </div>
      {expanded && (
        <div id={hintId} className="mt-3 space-y-2 border-t border-[#e8d5b8] pt-3 text-xs leading-relaxed text-[#66533b]">
          <p><span className="font-semibold text-[#8b5a17]">{language === 'zh' ? '提示' : 'Hint'}：</span>{moment.hint[language]}</p>
          <p><span className="font-semibold text-[#8b5a17]">{language === 'zh' ? '预期观察' : 'Expected observation'}：</span>{moment.expectedObservation[language]}</p>
        </div>
      )}
    </aside>
  );
};
