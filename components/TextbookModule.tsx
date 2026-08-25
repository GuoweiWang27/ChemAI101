import React from 'react';
import { ALL_REACTIONS, CHAPTERS } from '../src/data/reactions';
import { BookOpen, FlaskConical } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { updateRouteParams } from '../utils/routeParams';

/** 教材反应库：按人教版章节浏览策展反应，点击进入条目页（自学态）。 */
export const TextbookModule: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col h-full gap-6 p-6 overflow-y-auto">
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
        <h2 className="text-xl font-bold font-display text-[#1a1a1a] mb-1 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-science-600" /> {t('navLibraryCurated')}
        </h2>
        <p className="text-sm text-[#6f685d]">
          {t('curatedIntro')} · {t('curatedCount', { count: ALL_REACTIONS.length })}
        </p>
      </div>

      {ALL_REACTIONS.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-[#6f685d] bg-white/60 rounded-3xl border-2 border-dashed border-[#e8d5b8]">
          <BookOpen className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium">{t('curatedEmpty')}</p>
        </div>
      )}

      {CHAPTERS.map((chapter) => {
        const items = ALL_REACTIONS.filter((r) => r.chapter === chapter);
        return (
          <section key={chapter} className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
            <h3 className="text-base font-bold text-[#866027] uppercase tracking-wide mb-3">{chapter}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((r) => (
                <button
                  key={r.id}
                  onClick={() => updateRouteParams({ r: r.id })}
                  className="group text-left p-4 rounded-xl border border-[#e8d5b8] hover:border-science-400 hover:shadow-md transition-all bg-[#faf8f5]"
                >
                  <div className="font-semibold text-[#1a1a1a] group-hover:text-science-700 transition-colors flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 shrink-0 text-science-500" />
                    <span className="truncate">{r.title}</span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-[#6f685d] truncate">{r.equation}</div>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
