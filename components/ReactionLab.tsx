import React, { useState } from 'react';
import { predictReaction } from '../services/geminiService';
import { ReactionResult } from '../types';
import { Molecule3DViewer } from './Molecule3DViewer';
import { Play, Pause, FastForward, Loader2, Beaker, Flame, Wind } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export const ReactionLab: React.FC = () => {
  const [reactants, setReactants] = useState('');
  const [conditions, setConditions] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReactionResult | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const { t, language } = useLanguage();

  const handlePredict = async () => {
    if (!reactants) return;
    setLoading(true);
    setResult(null);
    setIsPlaying(false); // Reset playing state
    setCurrentStepIndex(0);
    try {
      const data = await predictReaction(reactants, conditions, language);
      setResult(data);
    } catch (e) {
      alert(t('failedToAnalyze'));
    } finally {
      setLoading(false);
    }
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
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Beaker className="w-5 h-5 text-science-600" /> {t('reactionSetup')}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('reactants')}</label>
              <textarea
                value={reactants}
                onChange={(e) => setReactants(e.target.value)}
                placeholder={t('placeholderReactants')}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">{t('conditions')}</label>
              <div className="relative">
                <Flame className="absolute top-3 left-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder={t('placeholderConditions')}
                  className="w-full pl-9 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
                />
              </div>
            </div>

            <button
              onClick={handlePredict}
              disabled={loading || !reactants}
              className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-md transition-all flex items-center justify-center gap-2
                ${loading || !reactants ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 hover:shadow-lg'}`}
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <Wind className="w-5 h-5" />}
              {loading ? t('analyzingBtn') : t('predictBtn')}
            </button>
          </div>
        </div>

        {/* Mechanism Control Panel - Only visible if results exist */}
        {result && (
          <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 flex-1 overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-slate-800 mb-3">{t('mechanism')}</h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 relative">
               <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>
               {result.mechanismSteps.map((step, idx) => (
                 <div 
                    key={idx} 
                    className={`relative pl-8 py-2 transition-all duration-300 ${idx === currentStepIndex ? 'opacity-100 scale-100' : 'opacity-50 scale-95'}`}
                 >
                   <div className={`absolute left-[13px] top-4 w-3 h-3 rounded-full border-2 z-10 ${idx === currentStepIndex ? 'bg-science-500 border-white shadow-md' : 'bg-slate-300 border-white'}`}></div>
                   <p className={`text-sm ${idx === currentStepIndex ? 'text-slate-800 font-medium' : 'text-slate-500'}`}>
                     {step}
                   </p>
                 </div>
               ))}
            </div>
            
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between">
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 rounded-full hover:bg-slate-100 text-science-600 transition-colors"
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              </button>
              <div className="text-xs text-slate-400 font-mono">
                {t('step')} {currentStepIndex + 1} / {result.mechanismSteps.length}
              </div>
              <button 
                 onClick={() => setCurrentStepIndex(0)}
                 className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
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
                 <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">{t('reactionResult')}</h2>
                 <div className="p-4 bg-science-50 rounded-xl border border-science-200 font-mono text-lg text-science-800 break-words">
                   {result.equation}
                 </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('productsIdentified')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.products.map((p, i) => (
                        <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-full text-sm text-slate-700 shadow-sm">
                          {p}
                        </span>
                      ))}
                    </div>
                 </div>
                 <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">{t('geometry')}</h4>
                    <p className="text-sm text-slate-700">{result.vseprInfo}</p>
                 </div>
               </div>
            </div>

            <div className="flex-1 min-h-[400px] bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800">{t('productStructure')}</h3>
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded border border-green-200">{t('interactive')}</span>
              </div>
              <div className="flex-1 relative">
                 <Molecule3DViewer structure={result.productStructure} />
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200">
            <Beaker className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('readyToSimulate')}</p>
            <p className="text-sm">{t('enterReactants')}</p>
          </div>
        )}
      </div>
    </div>
  );
};