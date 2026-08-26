import React, { useEffect, useState } from 'react';
import { Atom, BookOpen, ChevronRight, Database, FlaskConical } from 'lucide-react';
import { ALL_REACTIONS } from '../src/data/reactions';
import { fetchUsageStats, UsageStats } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { HeroReactionCanvas } from './HeroReactionCanvas';

export type HomeTab = 'textbook' | 'reaction' | 'builder' | 'library';

interface HomeModuleProps {
  onOpen: (tab: HomeTab) => void;
}

/** 首页 Dashboard：四大模块入口卡片，默认落地页。 */
export const HomeModule: React.FC<HomeModuleProps> = ({ onOpen }) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<UsageStats | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchUsageStats(controller.signal)
      .then(setStats)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const cards: Array<{
    tab: HomeTab;
    icon: React.ReactNode;
    title: string;
    desc: string;
    extra?: React.ReactNode;
  }> = [
    {
      tab: 'textbook',
      icon: <BookOpen className="w-7 h-7" />,
      title: t('navLibraryCurated'),
      desc: t('homeCardCuratedDesc'),
      extra: (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#eef3f1] text-science-700 border border-science-200">
            {t('homeReadyReactions', { count: ALL_REACTIONS.length })}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs bg-[#faf8f5] text-[#8a6116] border border-[#ecd9ae]">
            {t('homeReviewBadge')}
          </span>
        </div>
      ),
    },
    {
      tab: 'reaction',
      icon: <FlaskConical className="w-7 h-7" />,
      title: t('navReaction'),
      desc: t('homeCardLabDesc'),
      extra: (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="px-2.5 py-1 rounded-full text-xs bg-[#faf8f5] text-[#6f685d] border border-[#e8d5b8]">{t('homeLabBadge')}</span>
        </div>
      ),
    },
    {
      tab: 'builder',
      icon: <Atom className="w-7 h-7" />,
      title: t('navBuilder'),
      desc: t('homeCardBuilderDesc'),
      extra: (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="px-2.5 py-1 rounded-full text-xs bg-[#faf8f5] text-[#6f685d] border border-[#e8d5b8]">{t('homeBuilderBadge')}</span>
        </div>
      ),
    },
    {
      tab: 'library',
      icon: <Database className="w-7 h-7" />,
      title: t('navLibrary'),
      desc: t('homeCardPubchemDesc'),
      extra: (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className="px-2.5 py-1 rounded-full text-xs bg-[#faf8f5] text-[#6f685d] border border-[#e8d5b8]">{t('homePubchemBadge')}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero：暖纸色反应动画 + 标语 */}
        <div className="relative mb-8 sm:mb-10 rounded-3xl overflow-hidden bg-gradient-to-br from-[#fbf9f4] via-[#f6f1e7] to-[#efe7d8] border border-[#e8d5b8] shadow-lg">
          <div className="absolute inset-0">
            <HeroReactionCanvas />
          </div>
          {/* 可读性渐变：左浓右淡，文字压左侧 */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-[#fbf9f4]/85 via-[#fbf9f4]/35 to-transparent" />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 90% at 85% 30%, transparent 55%, rgba(134,96,39,0.12) 100%)' }} />
          <div className="relative z-10 p-7 sm:p-12 min-h-[360px] sm:min-h-[440px] flex flex-col justify-center max-w-2xl pointer-events-none select-none">
            <p className="text-xs font-bold uppercase tracking-widest text-science-500 mb-3">ChemAI101</p>
            <h2 className="text-3xl sm:text-5xl font-bold font-display leading-tight tracking-tight text-[#1a1a1a]">
              {t('homeTaglineMain')}
              <span className="bg-gradient-to-r from-science-600 to-science-400 bg-clip-text text-transparent">
                {t('homeTaglineAccent')}
              </span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[#6f685d] max-w-xl leading-relaxed">{t('homeSubline')}</p>
            {stats && stats.total > 0 && (
              <p className="mt-3 text-sm text-[#a39a89] font-mono">
                {t('homeStatsLine', { count: stats.total.toLocaleString('en-US') })}
              </p>
            )}
          </div>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {cards.map((card) => (
            <button
              key={card.tab}
              onClick={() => onOpen(card.tab)}
              className="group text-left p-6 rounded-2xl shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-science-300 hover:bg-science-50/50 flex flex-col bg-white border border-[#f0ece4]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-[#f0ece4] text-science-600 group-hover:bg-science-600 group-hover:text-white transition-colors">
                  {card.icon}
                </div>
                <ChevronRight className="w-5 h-5 text-[#c9bda5] group-hover:text-science-500 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold font-display text-[#1a1a1a] mb-1">{card.title}</h3>
              <p className="text-sm text-[#5c5549] leading-relaxed">{card.desc}</p>
              {card.extra}
            </button>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-[#a39a89]">
          ChemAI101 · Guowei Wang's Chemistry Club · Powered by DeepSeek & PubChem
        </p>
      </div>
    </div>
  );
};
