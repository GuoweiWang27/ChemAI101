import React from 'react';
import { ALL_REACTIONS, CHAPTERS } from '../src/data/reactions';
import { BookOpen, FlaskConical, GraduationCap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { groupChaptersByVolume, parseChapter } from '../utils/textbook';
import { updateRouteParams } from '../utils/routeParams';
import { isFlagshipReactionScene } from '../utils/flagshipReaction';

/** 教材反应库：按人教版卷册→章节两级浏览策展反应，点击进入条目页（自学态）。 */
export const TextbookModule: React.FC = () => {
  const { t, language } = useLanguage();
  const volumes = groupChaptersByVolume(CHAPTERS);

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

      {volumes.map(({ volumeCode, info, chapters }) => (
        <section key={volumeCode} className="flex flex-col gap-4">
          {/* 卷册头 */}
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-science-600 to-science-500 text-white shadow-md">
            <GraduationCap className="w-5 h-5 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm sm:text-base leading-tight">{info.volumeLabel[language]}</div>
              {info.grade[language] && (
                <div className="text-xs text-white/75 mt-0.5">{info.grade[language]}</div>
              )}
            </div>
            <span className="ml-auto shrink-0 px-2 py-0.5 rounded-full text-xs font-mono bg-white/15 border border-white/25">
              {volumeCode}
            </span>
          </div>

          {/* 章节小节 */}
          {chapters.map((chapter) => {
            const items = ALL_REACTIONS.filter((r) => r.chapter === chapter);
            const chapterTitle = parseChapter(chapter).chapterTitle || chapter;
            return (
              <div key={chapter} className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
                <h3 className="text-base font-bold text-[#866027] uppercase tracking-wide mb-3">{chapterTitle}</h3>
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
                      {isFlagshipReactionScene(r.reactionAnimation) && (
                        <div className="mt-2 inline-flex rounded-full border border-[#d8b779] bg-[#fff7df] px-2 py-0.5 text-[10px] font-bold tracking-wide text-[#8b5a17]">
                          {language === 'zh' ? '课堂旗舰' : 'Classroom flagship'} · {r.reactionAnimation.qualityLevel}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
};
