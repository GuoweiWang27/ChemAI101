import React, { useState } from 'react';
import { predictReaction, interpretPhenomenon, trackEvent, ReactionCandidate } from '../services/geminiService';
import { ReactionResult } from '../types';
import { Molecule3DViewer } from './Molecule3DViewer';
import { Play, Pause, FastForward, Loader2, Beaker, Flame, Wind, ShieldCheck, ShieldAlert, ShieldQuestion, Presentation, Sparkles, MessageSquareText, FlaskConical } from 'lucide-react';
import { PresentationMode } from './PresentationMode';
import { useLanguage } from '../contexts/LanguageContext';

type LabMode = 'phenomenon' | 'pro';

const PHENOMENON_EXAMPLES: Record<'zh' | 'en', string[]> = {
  zh: ['我想看大象牙膏的反应原理', '蓝瓶子实验为什么会变色', '暖宝宝为什么会发热', '氨气喷泉实验的原理'],
  en: ['The principle behind elephant toothpaste', 'Why the blue bottle experiment changes color', 'How hand warmers produce heat', 'The ammonia fountain experiment'],
};

export const ReactionLab: React.FC = () => {
  const [mode, setMode] = useState<LabMode>('phenomenon');
  const [reactants, setReactants] = useState('');
  const [conditions, setConditions] = useState('');
  const [phenomenon, setPhenomenon] = useState('');
  const [interpreting, setInterpreting] = useState(false);
  const [candidates, setCandidates] = useState<ReactionCandidate[] | null>(null);
  const [interpretNote, setInterpretNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReactionResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const { t, language } = useLanguage();

  const handlePredict = async (r: string = reactants, c: string = conditions) => {
    if (!r) return;
    setLoading(true);
    setResult(null);
    setIsPlaying(false); // Reset playing state
    setCurrentStepIndex(0);
    try {
      const data = await predictReaction(r, c, language);
      setResult(data);
      trackEvent('reaction');
    } catch (e) {
      alert(t('failedToAnalyze'));
    } finally {
      setLoading(false);
    }
  };

  const handleInterpret = async () => {
    if (!phenomenon.trim()) return;
    setInterpreting(true);
    setCandidates(null);
    setInterpretNote('');
    try {
      const data = await interpretPhenomenon(phenomenon, language);
      if (data.candidates.length === 0) {
        setInterpretNote(data.note || t('interpretEmpty'));
      } else {
        setCandidates(data.candidates.slice(0, 3));
      }
    } catch (e) {
      alert(t('failedToAnalyze'));
    } finally {
      setInterpreting(false);
    }
  };

  const handlePick = (cand: ReactionCandidate) => {
    setReactants(cand.reactants);
    setConditions(cand.conditions);
    setCandidates(null);
    setInterpretNote('');
    void handlePredict(cand.reactants, cand.conditions);
  };

  // Simple animation loop for mechanism steps
  React.useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying && result) {
      interval = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev >= result.mechanismSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 2000); // 2 seconds per step
    }
    return () => clearInterval(interval);
  }, [isPlaying, result]);

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 p-6">
      {/* Left Panel: Input & Controls */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
          <h2 className="text-xl font-bold font-display text-[#1a1a1a] mb-4 flex items-center gap-2">
            <Beaker className="w-5 h-5 text-science-600" /> {t('reactionSetup')}
          </h2>

          {/* Mode tabs */}
          <div className="flex gap-2 mb-5 p-1 bg-[#f5f0e8] rounded-xl">
            {([
              { key: 'phenomenon' as LabMode, label: t('labModePhenomenon'), icon: <MessageSquareText className="w-3.5 h-3.5" /> },
              { key: 'pro' as LabMode, label: t('labModePro'), icon: <FlaskConical className="w-3.5 h-3.5" /> },
            ]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  mode === key ? 'bg-white text-science-700 shadow-sm' : 'text-[#8a8171] hover:text-[#5c5549]'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {mode === 'phenomenon' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5c5549] mb-1">{t('phenomenonLabel')}</label>
                <textarea
                  value={phenomenon}
                  onChange={(e) => setPhenomenon(e.target.value)}
                  placeholder={t('phenomenonPlaceholder')}
                  className="w-full p-3 border border-[#e8d5b8] rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
                  rows={3}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {PHENOMENON_EXAMPLES[language].map((example) => (
                  <button
                    key={example}
                    onClick={() => setPhenomenon(example)}
                    className="px-2.5 py-1 rounded-full text-xs bg-[#f5f0e8] border border-[#e8d5b8] text-[#6f685d] hover:border-science-400 hover:text-science-700 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
              <button
                onClick={handleInterpret}
                disabled={interpreting || !phenomenon.trim()}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-md transition-all flex items-center justify-center gap-2
                  ${interpreting || !phenomenon.trim() ? 'bg-[#D4A76A] cursor-not-allowed' : 'bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 hover:shadow-lg'}`}
              >
                {interpreting ? <Loader2 className="animate-spin w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                {interpreting ? t('interpretingBtn') : t('interpretBtn')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#5c5549] mb-1">{t('reactants')}</label>
                <textarea
                  value={reactants}
                  onChange={(e) => setReactants(e.target.value)}
                  placeholder={t('placeholderReactants')}
                  className="w-full p-3 border border-[#e8d5b8] rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#5c5549] mb-1">{t('conditions')}</label>
                <div className="relative">
                  <Flame className="absolute top-3 left-3 w-4 h-4 text-[#6f685d]" />
                  <input
                    type="text"
                    value={conditions}
                    onChange={(e) => setConditions(e.target.value)}
                    placeholder={t('placeholderConditions')}
                    className="w-full pl-9 p-3 border border-[#e8d5b8] rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
                  />
                </div>
              </div>

              <button
                onClick={() => handlePredict()}
                disabled={loading || !reactants}
                className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-md transition-all flex items-center justify-center gap-2
                  ${loading || !reactants ? 'bg-[#D4A76A] cursor-not-allowed' : 'bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 hover:shadow-lg'}`}
              >
                {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Wind className="w-5 h-5" />}
                {loading ? t('analyzingBtn') : t('predictBtn')}
              </button>
            </div>
          )}
        </div>

        {/* Interpretation candidates */}
        {(candidates !== null || interpretNote) && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
            {candidates && candidates.length > 0 && (
              <>
                <p className="text-sm font-medium text-[#5c5549] mb-3">{t('pickCandidate')}</p>
                <div className="space-y-3">
                  {candidates.map((cand, i) => (
                    <div key={i} className="p-4 rounded-xl border border-[#e8d5b8] bg-[#faf8f5] hover:border-science-400 transition-colors">
                      <div className="font-mono text-sm text-science-800 break-words">{cand.equation}</div>
                      <p className="mt-2 text-xs leading-relaxed text-[#6f685d]">{cand.rationale}</p>
                      <button
                        onClick={() => handlePick(cand)}
                        disabled={loading}
                        className="mt-3 w-full py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 transition-all disabled:opacity-50"
                      >
                        {loading ? t('analyzingBtn') : t('confirmCandidate')}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { setCandidates(null); setInterpretNote(''); }}
                  className="mt-3 w-full py-2 rounded-lg text-xs text-[#6f685d] hover:bg-[#f5f0e8] transition-colors"
                >
                  {t('noneMatchBtn')}
                </button>
              </>
            )}
            {!candidates && interpretNote && (
              <p className="text-sm text-[#8a6116] bg-[#fdf3e0] border border-[#ecd9ae] rounded-xl p-3">{interpretNote}</p>
            )}
          </div>
        )}

        {/* Mechanism Control Panel - Only visible if results exist */}
        {result && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4] flex-1 overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-[#1a1a1a] mb-3">{t('mechanism')}</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative">
               <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#e8d5b8]"></div>
               {result.mechanismSteps.map((step, idx) => (
                 <div
                    key={idx}
                    className={`relative pl-8 py-2 transition-all duration-300 ${idx === currentStepIndex ? 'opacity-100 scale-100' : 'opacity-50 scale-95'}`}
                 >
                   <div className={`absolute left-[13px] top-4 w-3 h-3 rounded-full border-2 z-10 ${idx === currentStepIndex ? 'bg-science-500 border-white shadow-md' : 'bg-[#D4A76A] border-white'}`}></div>
                   <p className={`text-sm ${idx === currentStepIndex ? 'text-[#1a1a1a] font-medium' : 'text-[#6f685d]'}`}>
                     {step}
                   </p>
                 </div>
               ))}
            </div>

            <div className="pt-4 mt-2 border-t border-[#f0ece4] flex items-center justify-between">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-full hover:bg-[#f0ece4] text-science-600 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <div className="text-xs text-[#866027] font-mono">
                {t('step')} {currentStepIndex + 1} / {result.mechanismSteps.length}
              </div>
              <button
                 onClick={() => setCurrentStepIndex(0)}
                 className="p-2 rounded-full hover:bg-[#f0ece4] text-[#6f685d] transition-colors"
              >
                <FastForward className="w-5 h-5 rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel: Visualization & Result */}
      <div className="w-full lg:w-2/3 flex flex-col gap-6">
        {result ? (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-science-100">
               <div className="mb-4">
                 <h2 className="text-2xl font-bold font-display text-[#1a1a1a] tracking-tight mb-2">{t('reactionResult')}</h2>
                 <div className="p-4 bg-science-50 rounded-xl border border-science-200 font-mono text-lg text-science-800 break-words">
                   {result.equation}
                 </div>
                 {result.verification && (
                   <div className={`mt-3 p-3 rounded-xl border text-sm ${
                     result.verification.status === 'verified'
                       ? 'bg-[#e8f5ec] border-[#bfe3cc] text-[#1f7a44]'
                       : result.verification.status === 'warning'
                         ? 'bg-[#fdf3e0] border-[#ecd9ae] text-[#8a6116]'
                         : 'bg-[#f5f0e8] border-[#e8d5b8] text-[#5c5549]'
                   }`}>
                     <div className="flex items-center gap-2 font-semibold">
                       {result.verification.status === 'verified'
                         ? <ShieldCheck className="w-4 h-4" />
                         : result.verification.status === 'warning'
                           ? <ShieldAlert className="w-4 h-4" />
                           : <ShieldQuestion className="w-4 h-4" />}
                       <span>
                         {result.verification.status === 'verified'
                           ? t('verifyVerified')
                           : result.verification.status === 'warning'
                             ? t('verifyWarning')
                             : t('verifyUnknown')}
                       </span>
                     </div>
                     {result.verification.issues.length > 0 && (
                       <ul className="mt-1 list-disc pl-5 space-y-0.5">
                         {result.verification.issues.map((issue, i) => (
                           <li key={i}>{issue}</li>
                         ))}
                       </ul>
                     )}
                   </div>
                 )}
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 bg-[#f5f0e8] rounded-xl border border-[#e8d5b8]">
                    <h4 className="text-xs font-bold text-[#866027] uppercase mb-2">{t('productsIdentified')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.products.map((p, i) => (
                        <span key={i} className="px-3 py-1 bg-white border border-[#e8d5b8] rounded-full text-sm text-[#1a1a1a] shadow-sm">
                          {p}
                        </span>
                      ))}
                    </div>
                 </div>
                 <div className="p-4 bg-[#f5f0e8] rounded-xl border border-[#e8d5b8]">
                    <h4 className="text-xs font-bold text-[#866027] uppercase mb-2">{t('geometry')}</h4>
                    <p className="text-sm text-[#5c5549]">{result.vseprInfo}</p>
                 </div>
               </div>
            </div>

            <div className="flex-1 min-h-[400px] bg-white rounded-2xl shadow-lg border border-[#f0ece4] overflow-hidden flex flex-col">
              <div className="p-4 border-b border-[#f0ece4] flex justify-between items-center">
                <h3 className="font-semibold text-[#1a1a1a]">{t('productStructure')}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPresenting(true)}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-[#f5f0e8] text-[#866027] rounded border border-[#e8d5b8] hover:bg-[#efe6d5] transition-colors"
                  >
                    <Presentation className="w-3 h-3" /> {t('demoBtn')}
                  </button>
                  <span className="text-xs px-2 py-1 bg-[#e6f2f0] text-[#2a7c6f] rounded border border-[#2a7c6f]/25">{t('interactive')}</span>
                </div>
              </div>
              <div className="flex-1 relative">
                 <Molecule3DViewer structure={result.productStructure} />
              </div>
            </div>
            {presenting && result && (
              <PresentationMode
                equation={result.equation}
                conditions={conditions}
                title={t('reactionResult')}
                steps={result.mechanismSteps}
                structure={result.productStructure}
                onClose={() => setPresenting(false)}
              />
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[#6f685d] bg-white/60 rounded-3xl border-2 border-dashed border-[#e8d5b8]">
            <Beaker className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('readyToSimulate')}</p>
            <p className="text-sm">{mode === 'phenomenon' ? t('phenomenonLabel') : t('enterReactants')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
