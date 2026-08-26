import React, { useState } from 'react';
import { CompoundNotFoundError, fetchCompound, identifyMoleculeByDesc, trackEvent, MoleculeCandidate } from '../services/geminiService';
import { CompoundRecord } from '../types';
import { Molecule3DViewer } from './Molecule3DViewer';
import { Database, FlaskConical, Loader2, Search, Sparkles, MessageSquareText } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; variant: 'notFound' | 'busy' | 'network' }
  | { kind: 'ready'; record: CompoundRecord };

type LibTab = 'ai' | 'name';

const MOLECULE_EXAMPLES: Record<'zh' | 'en', string[]> = {
  zh: [
    '无色有刺激性气味的气体，能使品红溶液褪色',
    '最轻的气体，燃烧产生淡蓝色火焰',
    '紫黑色有金属光泽的固体，易升华成紫色蒸气',
    '无色无味的气体，能供给呼吸、支持燃烧',
  ],
  en: [
    'A colorless pungent gas that bleaches dyestuffs',
    'The lightest gas, burns with a pale blue flame',
    'A purple-black shiny solid that sublimes into violet vapor',
    'A colorless odorless gas supporting respiration and combustion',
  ],
};

export const LibraryModule: React.FC = () => {
  const [tab, setTab] = useState<LibTab>('ai');
  const [query, setQuery] = useState('');
  const [description, setDescription] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [molCandidates, setMolCandidates] = useState<MoleculeCandidate[] | null>(null);
  const [identifyNote, setIdentifyNote] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const { t, language } = useLanguage();

  const searchByName = async (name: string) => {
    if (!name) return;
    setState({ kind: 'loading' });
    try {
      const record = await fetchCompound(name);
      setState({ kind: 'ready', record });
      trackEvent('compound');
    } catch (error) {
      if (error instanceof CompoundNotFoundError) setState({ kind: 'error', variant: 'notFound' });
      else if (error instanceof Error && error.message.endsWith('(503)')) {
        setState({ kind: 'error', variant: 'busy' });
      } else setState({ kind: 'error', variant: 'network' });
    }
  };

  const handleSearch = async () => {
    await searchByName(query.trim());
  };

  const handleIdentify = async () => {
    if (!description.trim()) return;
    setIdentifying(true);
    setMolCandidates(null);
    setIdentifyNote('');
    try {
      const data = await identifyMoleculeByDesc(description, language);
      if (data.candidates.length === 0) {
        setIdentifyNote(data.note || t('interpretEmpty'));
      } else {
        setMolCandidates(data.candidates.slice(0, 3));
      }
    } catch (e) {
      alert(t('networkErrorMsg'));
    } finally {
      setIdentifying(false);
    }
  };

  const handlePickMolecule = (cand: MoleculeCandidate) => {
    setQuery(cand.name);
    setMolCandidates(null);
    setIdentifyNote('');
    void searchByName(cand.name);
  };

  const errorText =
    state.kind === 'error'
      ? t(state.variant === 'notFound' ? 'notFoundMsg' : state.variant === 'busy' ? 'dataBusyMsg' : 'networkErrorMsg')
      : '';

  return (
    <div className="flex flex-col h-full gap-6 p-6">
      {/* Search bar */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
        <h2 className="text-xl font-bold font-display text-[#1a1a1a] mb-1 flex items-center gap-2">
          <Database className="w-5 h-5 text-science-600" /> {t('navLibrary')}
        </h2>
        <p className="text-sm text-[#6f685d] mb-4">{t('libraryIntro')}</p>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-5 p-1 bg-[#f5f0e8] rounded-xl max-w-md">
          {([
            { key: 'ai' as LibTab, label: t('libTabAi'), icon: <Sparkles className="w-3.5 h-3.5" /> },
            { key: 'name' as LibTab, label: t('libTabName'), icon: <Search className="w-3.5 h-3.5" /> },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                tab === key ? 'bg-white text-science-700 shadow-sm' : 'text-[#8a8171] hover:text-[#5c5549]'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'ai' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#5c5549] mb-1">{t('describeMoleculeLabel')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('describeMoleculePlaceholder')}
                className="w-full p-3 border border-[#e8d5b8] rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {MOLECULE_EXAMPLES[language].map((example) => (
                <button
                  key={example}
                  onClick={() => setDescription(example)}
                  className="px-2.5 py-1 rounded-full text-xs bg-[#f5f0e8] border border-[#e8d5b8] text-[#6f685d] hover:border-science-400 hover:text-science-700 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
            <button
              onClick={handleIdentify}
              disabled={identifying || !description.trim()}
              className={`py-3 px-6 rounded-lg font-semibold text-white shadow-md transition-all flex items-center gap-2
                ${identifying || !description.trim() ? 'bg-[#D4A76A] cursor-not-allowed' : 'bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 hover:shadow-lg'}`}
            >
              {identifying ? <Loader2 className="animate-spin w-5 h-5" /> : <MessageSquareText className="w-5 h-5" />}
              {identifying ? t('identifyingMolBtn') : t('identifyMolBtn')}
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <div className="relative flex-1">
              <FlaskConical className="absolute top-3 left-3 w-4 h-4 text-[#6f685d]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-9 p-3 border border-[#e8d5b8] rounded-lg focus:ring-2 focus:ring-science-500 focus:border-transparent transition-all outline-none"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={state.kind === 'loading' || !query.trim()}
              className={`px-6 rounded-lg font-semibold text-white shadow-md transition-all flex items-center gap-2 whitespace-nowrap
                ${state.kind === 'loading' || !query.trim() ? 'bg-[#D4A76A] cursor-not-allowed' : 'bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 hover:shadow-lg'}`}
            >
              {state.kind === 'loading' ? <Loader2 className="animate-spin w-5 h-5" /> : <Search className="w-5 h-5" />}
              {state.kind === 'loading' ? t('searchingBtn') : t('searchBtn')}
            </button>
          </div>
        )}
      </div>

      {/* AI candidates */}
      {(molCandidates !== null || identifyNote) && tab === 'ai' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
          {molCandidates && molCandidates.length > 0 && (
            <>
              <p className="text-sm font-medium text-[#5c5549] mb-3">{t('pickMoleculeHint')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {molCandidates.map((cand, i) => (
                  <div key={i} className="p-4 rounded-xl border border-[#e8d5b8] bg-[#faf8f5] hover:border-science-400 transition-colors flex flex-col">
                    <div className="font-semibold text-[#1a1a1a]">{cand.name}</div>
                    <div className="font-mono text-xs text-science-700 mt-0.5">{cand.formula}</div>
                    <p className="mt-2 text-xs leading-relaxed text-[#6f685d] flex-1">{cand.rationale}</p>
                    <button
                      onClick={() => handlePickMolecule(cand)}
                      disabled={state.kind === 'loading'}
                      className="mt-3 w-full py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-science-600 to-science-500 hover:from-science-700 hover:to-science-600 transition-all disabled:opacity-50"
                    >
                      {t('confirmMoleculeBtn')}
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => { setMolCandidates(null); setIdentifyNote(''); }}
                className="mt-3 text-xs text-[#6f685d] hover:bg-[#f5f0e8] rounded-lg px-3 py-1.5 transition-colors"
              >
                {t('noneMatchBtn')}
              </button>
            </>
          )}
          {!molCandidates && identifyNote && (
            <p className="text-sm text-[#8a6116] bg-[#fdf3e0] border border-[#ecd9ae] rounded-xl p-3">{identifyNote}</p>
          )}
        </div>
      )}

      {/* Result area */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {state.kind === 'ready' && (
          <>
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-science-100 flex flex-col gap-4">
              <div>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-[#e6f2f0] text-[#2a7c6f] border border-[#2a7c6f]/25">
                  <Database className="w-3 h-3" /> {t('sourceBadge')} · CID {state.record.cid}
                </span>
                <span className="ml-2 inline-block px-2 py-1 rounded-full text-xs font-medium bg-[#f5f0e8] text-[#866027] border border-[#e8d5b8]">
                  {state.record.structureType === '3d' ? t('structure3dBadge') : t('structure2dBadge')}
                </span>
              </div>
              {state.record.molecularFormula && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#866027] font-bold">{t('formulaLabel')}</div>
                  <div className="font-mono text-2xl text-science-800">{state.record.molecularFormula}</div>
                </div>
              )}
              {state.record.molecularWeight && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#866027] font-bold">{t('weightLabel')}</div>
                  <div className="font-mono text-xl text-[#1a1a1a]">
                    {state.record.molecularWeight} {t('gPerMol')}
                  </div>
                </div>
              )}
              {state.record.iupacName && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#866027] font-bold">{t('iupacLabel')}</div>
                  <div className="text-sm text-[#5c5549] italic">{state.record.iupacName}</div>
                </div>
              )}
            </div>
            <div className="lg:col-span-2 min-h-[400px] bg-white rounded-2xl shadow-lg border border-[#f0ece4] overflow-hidden">
              <Molecule3DViewer structure={state.record.structure} />
            </div>
          </>
        )}
        {state.kind === 'error' && (
          <div className="lg:col-span-3 bg-white rounded-2xl border-2 border-dashed border-[#e8d5b8] flex items-center justify-center text-[#8C1515]">
            {errorText}
          </div>
        )}
        {state.kind === 'idle' && (
          <div className="lg:col-span-3 bg-white/60 rounded-3xl border-2 border-dashed border-[#e8d5b8] flex flex-col items-center justify-center text-[#6f685d]">
            <Database className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('libraryIntro')}</p>
          </div>
        )}
        {state.kind === 'loading' && (
          <div className="lg:col-span-3 bg-white rounded-3xl border-2 border-dashed border-science-300 flex flex-col items-center justify-center text-[#6f685d] animate-pulse">
            <Loader2 className="w-14 h-14 mb-4 animate-spin text-science-500" />
            <p className="text-lg font-medium text-[#1a1a1a]">{t('searchingBtn')}</p>
            <p className="text-sm mt-1">{t('libraryIntro')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
