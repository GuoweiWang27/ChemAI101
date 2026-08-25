import React, { useState } from 'react';
import { CompoundNotFoundError, fetchCompound } from '../services/geminiService';
import { CompoundRecord } from '../types';
import { ALL_REACTIONS } from '../src/data/reactions';
import { Molecule3DViewer } from './Molecule3DViewer';
import { BookOpen, Database, FlaskConical, Loader2, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { updateRouteParams } from '../utils/routeParams';

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; variant: 'notFound' | 'busy' | 'network' }
  | { kind: 'ready'; record: CompoundRecord };

export const LibraryModule: React.FC = () => {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<LoadState>({ kind: 'idle' });
  const { t } = useLanguage();

  const handleSearch = async () => {
    const name = query.trim();
    if (!name) return;
    setState({ kind: 'loading' });
    try {
      const record = await fetchCompound(name);
      setState({ kind: 'ready', record });
    } catch (error) {
      if (error instanceof CompoundNotFoundError) setState({ kind: 'error', variant: 'notFound' });
      else if (error instanceof Error && error.message.endsWith('(503)')) {
        setState({ kind: 'error', variant: 'busy' });
      } else setState({ kind: 'error', variant: 'network' });
    }
  };

  const errorText =
    state.kind === 'error'
      ? t(state.variant === 'notFound' ? 'notFoundMsg' : state.variant === 'busy' ? 'dataBusyMsg' : 'networkErrorMsg')
      : '';

  return (
    <div className="flex flex-col h-full gap-6 p-6 overflow-y-auto">
      {/* Curated textbook library */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
        <h2 className="text-lg font-bold font-display text-[#1a1a1a] mb-3 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-science-600" /> {t('navLibraryCurated')}
        </h2>
        {ALL_REACTIONS.length === 0 ? (
          <p className="text-sm text-[#6f685d]">{t('curatedEmpty')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ALL_REACTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => updateRouteParams({ r: r.id })}
                title={`${r.chapter} · ${r.title}`}
                className="px-3 py-1.5 rounded-full text-sm border border-[#e8d5b8] hover:border-science-400 hover:text-science-700 transition-colors"
              >
                {r.title}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search bar */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-[#f0ece4]">
        <h2 className="text-xl font-bold font-display text-[#1a1a1a] mb-1 flex items-center gap-2">
          <Database className="w-5 h-5 text-science-600" /> {t('navLibrary')}
        </h2>
        <p className="text-sm text-[#6f685d] mb-4">{t('libraryIntro')}</p>
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
      </div>

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
        {(state.kind === 'idle' || state.kind === 'loading') && (
          <div className="lg:col-span-3 bg-white/60 rounded-3xl border-2 border-dashed border-[#e8d5b8] flex flex-col items-center justify-center text-[#6f685d]">
            <Database className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">{t('libraryIntro')}</p>
          </div>
        )}
      </div>
    </div>
  );
};
