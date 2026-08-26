import React from 'react';
import { AtomInsight } from '../src/data/reactions/schema';
import { ELEMENT_NAMES } from '../types';
import { X, Sparkles, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface AtomInsightPanelProps {
  /** 该原子的 AI 讲解；缺省时走元素静态卡降级 */
  insight?: AtomInsight;
  element: string;
  onClose: () => void;
}

/** 原子讲解面板：AI 预生成角色 + 展开，或元素信息兜底。悬浮于 3D 容器底部。 */
export const AtomInsightPanel: React.FC<AtomInsightPanelProps> = ({ insight, element, onClose }) => {
  const { t, language } = useLanguage();
  const name = ELEMENT_NAMES[element] ?? ELEMENT_NAMES.default;
  const isEn = language === 'en';

  return (
    <div className="absolute inset-x-4 bottom-4 z-20 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-[#f0ece4] p-4 animate-in fade-in slide-in-from-bottom-2">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1.5 rounded-lg text-[#8a8171] hover:bg-[#f0ece4] transition-colors"
        aria-label={t('closeBtn')}
      >
        <X className="w-4 h-4" />
      </button>
      {insight ? (
        <>
          <div className="flex items-center gap-2 pr-6">
            <Sparkles className="w-4 h-4 shrink-0 text-science-500" />
            <p className="font-semibold text-[#1a1a1a] text-sm">
              {isEn ? insight.role.en : insight.role.zh}
            </p>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-[#5c5549]">
            {isEn ? insight.detail.en : insight.detail.zh}
          </p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 pr-6">
            <Info className="w-4 h-4 shrink-0 text-[#8a8171]" />
            <p className="font-semibold text-[#1a1a1a] text-sm">
              {isEn ? name.en : name.zh} · {element}
            </p>
          </div>
          <p className="mt-1.5 text-xs text-[#8a8171]">{t('insightFallbackHint')}</p>
        </>
      )}
    </div>
  );
};
