import React from 'react';
import { Activity, CheckCircle2, FlaskConical, GitBranch, ShieldCheck } from 'lucide-react';
import { ALL_REACTIONS } from '../src/data/reactions';
import { ANIMATION_PROFILES } from '../src/data/reactions/animationProfiles';
import { FLAGSHIP_REACTION_IDS } from '../src/data/reactions/flagshipScenes';
import { compileReactionAnimationAudit } from '../utils/reactionAnimationAudit';
import { useLanguage } from '../contexts/LanguageContext';

const AUDIT_SUMMARY = compileReactionAnimationAudit(ALL_REACTIONS, ANIMATION_PROFILES).summary;
const FLAGSHIP_COUNT = FLAGSHIP_REACTION_IDS.filter((reactionId) => (
  ALL_REACTIONS.some((reaction) => reaction.id === reactionId && reaction.reactionAnimation?.version === 3)
)).length;

const Metric: React.FC<{ value: number; label: string; accent?: string }> = ({ value, label, accent = 'text-science-700' }) => (
  <div className="rounded-2xl border border-[#e8d5b8] bg-[#fffdf8] p-4">
    <div className={`font-mono text-2xl font-bold ${accent}`}>{value}</div>
    <div className="mt-1 text-xs leading-relaxed text-[#6f685d]">{label}</div>
  </div>
);

const StorySection: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}> = ({ icon, title, children }) => (
  <section className="rounded-2xl border border-[#f0ece4] bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center gap-2 text-[#866027]">
      <span className="rounded-lg bg-[#f5f0e8] p-2">{icon}</span>
      <h3 className="text-lg font-bold font-display text-[#1a1a1a]">{title}</h3>
    </div>
    <div className="mt-3 text-sm leading-7 text-[#5c5549]">{children}</div>
  </section>
);

export const ProjectStoryPage: React.FC = () => {
  const { t, language } = useLanguage();
  const qualityGateLabel = language === 'zh' ? '质量门禁失败' : 'quality gate failures';
  const reviewLabel = t('projectTeacherPending');

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="rounded-3xl border border-[#e8d5b8] bg-gradient-to-br from-[#fbf9f4] via-[#f6f1e7] to-[#efe7d8] p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-science-600">
            <FlaskConical className="h-4 w-4" />
            <span>ChemAI101 · Project</span>
          </div>
          <h2 className="mt-3 text-2xl font-bold font-display tracking-tight text-[#1a1a1a] sm:text-4xl">{t('projectStoryTitle')}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5c5549] sm:text-base">{t('projectStoryIntro')}</p>
        </header>

        <div className="grid gap-5 lg:grid-cols-2">
          <StorySection icon={<Activity className="h-4 w-4" />} title={t('projectWhyTitle')}>
            <p>{t('projectWhyBody')}</p>
          </StorySection>
          <StorySection icon={<GitBranch className="h-4 w-4" />} title={t('projectMethodTitle')}>
            <p>{t('projectMethodBody')}</p>
            <p className="mt-2 rounded-xl bg-[#faf8f5] px-3 py-2 font-mono text-xs text-[#6f685d]">scene v3 → macro / micro / equation / teaching</p>
          </StorySection>
        </div>

        <StorySection icon={<ShieldCheck className="h-4 w-4" />} title={t('projectQualityTitle')}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#9b6a22]">{t('projectRepositoryFacts')}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric value={AUDIT_SUMMARY.reactions} label={language === 'zh' ? '个反应' : 'reactions'} />
            <Metric value={AUDIT_SUMMARY.profiles} label={language === 'zh' ? '个 profile' : 'profiles'} />
            <Metric value={AUDIT_SUMMARY.flows} label={language === 'zh' ? '个反应流程' : 'reaction flows'} />
            <Metric value={AUDIT_SUMMARY.completeMappings} label={language === 'zh' ? '个完整映射' : 'complete mappings'} />
            <Metric value={FLAGSHIP_COUNT} label={language === 'zh' ? '个课堂旗舰' : 'classroom flagships'} accent="text-[#9b6a22]" />
            <Metric value={AUDIT_SUMMARY.qualityGateFailures} label={qualityGateLabel} accent="text-science-700" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[
              language === 'zh' ? '原子守恒' : 'atom conservation',
              language === 'zh' ? '事件映射' : 'event mapping',
              language === 'zh' ? '证据记录' : 'evidence records',
            ].map((label) => (
              <span key={label} className="inline-flex items-center gap-1 rounded-full border border-science-200 bg-[#eef3f1] px-2.5 py-1 font-semibold text-science-700">
                <CheckCircle2 className="h-3.5 w-3.5" /> {label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1 rounded-full border border-[#e8d5b8] bg-[#fffaf1] px-2.5 py-1 font-semibold text-[#866027]">
              <Activity className="h-3.5 w-3.5" /> {language === 'zh' ? '桌面 / 移动端发布 QA 范围' : 'desktop / mobile release QA scope'}
            </span>
          </div>
        </StorySection>

        <StorySection icon={<ShieldCheck className="h-4 w-4" />} title={t('projectBoundaryTitle')}>
          <div className="rounded-xl border border-[#ecd9ae] bg-[#fffaf1] px-4 py-3 font-semibold text-[#7f571d]">{reviewLabel}</div>
          <p className="mt-3">{language === 'zh'
            ? '四个新 L2 的 chemistry approval 是项目证据核对，不是教师签字；教师复核状态与化学审核分开记录。'
            : 'The four new L2 chemistry approvals are project evidence checks, not teacher sign-offs; teacher review is tracked separately from chemistry review.'}</p>
          <p className="mt-2">{t('projectEducationalBoundary')}</p>
        </StorySection>
      </div>
    </div>
  );
};
