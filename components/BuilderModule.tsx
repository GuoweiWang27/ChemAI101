import React, { useMemo, useState, useRef } from 'react';
import { BuilderAtom, BuilderBond, ElementType, ELEMENT_COLORS } from '../types';
import {
  identifyStructure,
  nameMoleculeFromGraph,
  IdentifyCandidate,
} from '../services/geminiService';
import { toIdentifyPayload, toSubscript, validateGraph } from '../utils/moleculeAnalysis';
import {
  Trash2,
  MousePointer2,
  Type,
  Info,
  RotateCcw,
  Loader2,
  Undo2,
  FlaskConical,
  Atom as AtomIcon,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const generateId = () => Math.random().toString(36).slice(2, 11);

interface Snapshot {
  atoms: BuilderAtom[];
  bonds: BuilderBond[];
}

/** 常用分子模板：一键铺开完整结构 */
const TEMPLATES: Array<{
  key: string;
  atoms: Array<{ el: string; x: number; y: number }>;
  bonds: Array<[number, number, number]>;
}> = [
  { key: 'H₂O', atoms: [{ el: 'O', x: 200, y: 170 }, { el: 'H', x: 120, y: 120 }, { el: 'H', x: 280, y: 120 }], bonds: [[0, 1, 1], [0, 2, 1]] },
  { key: 'CO₂', atoms: [{ el: 'C', x: 200, y: 170 }, { el: 'O', x: 90, y: 170 }, { el: 'O', x: 310, y: 170 }], bonds: [[0, 1, 2], [0, 2, 2]] },
  { key: 'CH₄', atoms: [{ el: 'C', x: 200, y: 175 }, { el: 'H', x: 110, y: 105 }, { el: 'H', x: 290, y: 105 }, { el: 'H', x: 110, y: 245 }, { el: 'H', x: 290, y: 245 }], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]] },
  { key: 'NH₃', atoms: [{ el: 'N', x: 200, y: 150 }, { el: 'H', x: 110, y: 210 }, { el: 'H', x: 290, y: 210 }, { el: 'H', x: 200, y: 70 }], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]] },
  { key: 'O₂', atoms: [{ el: 'O', x: 150, y: 170 }, { el: 'O', x: 260, y: 170 }], bonds: [[0, 1, 2]] },
];

type Tool = 'move' | 'bond' | 'delete' | ElementType;

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export const BuilderModule: React.FC = () => {
  const [atoms, setAtoms] = useState<BuilderAtom[]>([]);
  const [bonds, setBonds] = useState<BuilderBond[]>([]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool>(ElementType.C);
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [lastAtomId, setLastAtomId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [identifyResult, setIdentifyResult] = useState<{
    formulaDisplay: string;
    candidates: IdentifyCandidate[];
  } | null>(null);
  const [aiResult, setAiResult] = useState<{
    systematicName: string;
    commonName: string;
    explanation: string;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();

  // 实时化学状态（纯本地计算，零网络）
  const graph = useMemo(() => validateGraph(atoms, bonds), [atoms, bonds]);

  const pushHistory = () => {
    setHistory((prev) => [...prev.slice(-49), { atoms: [...atoms], bonds: [...bonds] }]);
  };

  const undo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setAtoms(last.atoms);
      setBonds(last.bonds);
      return prev.slice(0, -1);
    });
  };

  const hitAtom = (x: number, y: number) => atoms.find((a) => Math.hypot(a.x - x, a.y - y) < 20);

  const hitBond = (x: number, y: number) =>
    bonds.find((bond) => {
      const source = atoms.find((a) => a.id === bond.sourceId);
      const target = atoms.find((a) => a.id === bond.targetId);
      if (!source || !target) return false;
      return distToSegment(x, y, source.x, source.y, target.x, target.y) < 9;
    });

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (selectedTool === 'move') {
      const clicked = hitAtom(x, y);
      setSelectedAtomId(clicked ? clicked.id : null);
      return;
    }

    if (selectedTool === 'delete') {
      const atom = hitAtom(x, y);
      const bond = atom ? undefined : hitBond(x, y);
      if (!atom && !bond) return;
      pushHistory();
      if (atom) {
        setAtoms((prev) => prev.filter((a) => a.id !== atom.id));
        setBonds((prev) => prev.filter((b) => b.sourceId !== atom.id && b.targetId !== atom.id));
        if (lastAtomId === atom.id) setLastAtomId(null);
      } else if (bond) {
        setBonds((prev) => prev.filter((b) => b.id !== bond.id));
      }
      return;
    }

    if (selectedTool === 'bond') {
      const clicked = hitAtom(x, y);
      const bond = clicked ? undefined : hitBond(x, y);
      if (!clicked && bond) {
        // 点在键上：循环键级 1→2→3→1
        pushHistory();
        setBonds((prev) =>
          prev.map((b) => (b.id === bond.id ? { ...b, order: (b.order % 3) + 1 } : b)),
        );
        return;
      }
      if (!clicked) return;
      if (selectedAtomId && selectedAtomId !== clicked.id) {
        pushHistory();
        const existing = bonds.find(
          (b) =>
            (b.sourceId === selectedAtomId && b.targetId === clicked.id) ||
            (b.targetId === selectedAtomId && b.sourceId === clicked.id),
        );
        if (existing) {
          setBonds((prev) =>
            prev.map((b) => (b.id === existing.id ? { ...b, order: (b.order % 3) + 1 } : b)),
          );
        } else {
          setBonds((prev) => [
            ...prev,
            { id: generateId(), sourceId: selectedAtomId, targetId: clicked.id, order: 1 },
          ]);
        }
        setSelectedAtomId(null);
      } else {
        setSelectedAtomId(clicked.id);
        setLastAtomId(clicked.id);
      }
      return;
    }

    // 元素画笔：点已有原子=换链式锚点；点空白=新增原子并自动与锚点成单键
    const anchor = hitAtom(x, y);
    if (anchor) {
      setLastAtomId(anchor.id);
      return;
    }
    pushHistory();
    const newId = generateId();
    setAtoms((prev) => [...prev, { id: newId, element: selectedTool as string, x, y, charge: 0 }]);
    if (lastAtomId && atoms.some((a) => a.id === lastAtomId)) {
      const already = bonds.some(
        (b) =>
          (b.sourceId === lastAtomId && b.targetId === newId) ||
          (b.targetId === lastAtomId && b.sourceId === newId),
      );
      if (!already) {
        setBonds((prev) => [...prev, { id: generateId(), sourceId: lastAtomId, targetId: newId, order: 1 }]);
      }
    }
    setLastAtomId(newId);
  };

  const clearSelections = () => {
    setSelectedAtomId(null);
    setLastAtomId(null);
    setIdentifyResult(null);
    setAiResult(null);
  };

  const insertTemplate = (tpl: (typeof TEMPLATES)[number]) => {
    pushHistory();
    clearSelections();
    const offsetX = 60;
    const offsetY = 40;
    const idMap = new Map<number, string>();
    const newAtoms: BuilderAtom[] = tpl.atoms.map((a, i) => {
      const id = generateId();
      idMap.set(i, id);
      return { id, element: a.el, x: a.x + offsetX, y: a.y + offsetY, charge: 0 };
    });
    const newBonds: BuilderBond[] = tpl.bonds.map(([i, j, order]) => ({
      id: generateId(),
      sourceId: idMap.get(i)!,
      targetId: idMap.get(j)!,
      order,
    }));
    setAtoms((prev) => [...prev, ...newAtoms]);
    setBonds((prev) => [...prev, ...newBonds]);
    setLastAtomId(newAtoms[newAtoms.length - 1]?.id ?? null);
  };

  const clearCanvas = () => {
    pushHistory();
    setAtoms([]);
    setBonds([]);
    clearSelections();
  };

  // 分析：先 PubChem 分子式匹配（确定性），零候选时提供 AI 兜底
  const handleAnalyze = async () => {
    if (atoms.length === 0) return;
    setAnalyzing(true);
    setIdentifyResult(null);
    setAiResult(null);
    try {
      const payload = toIdentifyPayload(atoms, bonds);
      const res = await identifyStructure(payload.atoms, payload.bonds);
      setIdentifyResult({ formulaDisplay: toSubscript(res.formula), candidates: res.candidates });
    } catch {
      alert(t('failedToName'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAiFallback = async () => {
    setAnalyzing(true);
    setAiResult(null);
    try {
      const res = await nameMoleculeFromGraph(atoms, bonds, language);
      setAiResult(res);
    } catch {
      alert(t('failedToName'));
    } finally {
      setAnalyzing(false);
    }
  };

  const instructions = t('instructions') as string[];

  return (
    <div className="flex h-full flex-col lg:flex-row gap-6 p-6">
      {/* Toolbar */}
      <div className="w-full lg:w-64 flex flex-col gap-4 shrink-0 overflow-y-auto">
        <div className="bg-white p-4 rounded-xl shadow-md border border-[#f0ece4]">
          <h3 className="text-sm font-bold text-[#866027] uppercase mb-3">{t('tools')}</h3>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button onClick={() => setSelectedTool('move')} title={t('toolsTooltip.move')}
              className={`p-2 rounded-lg flex justify-center items-center transition-colors ${selectedTool === 'move' ? 'bg-science-100 text-science-600' : 'hover:bg-[#f0ece4] text-[#5c5549]'}`}>
              <MousePointer2 className="w-5 h-5" />
            </button>
            <button onClick={() => setSelectedTool('bond')} title={t('toolsTooltip.bond')}
              className={`p-2 rounded-lg flex justify-center items-center transition-colors ${selectedTool === 'bond' ? 'bg-science-100 text-science-600' : 'hover:bg-[#f0ece4] text-[#5c5549]'}`}>
              <div className="w-5 h-0.5 bg-current rotate-45"></div>
            </button>
            <button onClick={() => setSelectedTool('delete')} title={t('toolsTooltip.delete')}
              className={`p-2 rounded-lg flex justify-center items-center transition-colors ${selectedTool === 'delete' ? 'bg-[#8C1515]/10 text-[#8C1515]' : 'hover:bg-[#f0ece4] text-[#5c5549]'}`}>
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={undo} disabled={history.length === 0} title={t('undoTitle')}
              className={`p-2 rounded-lg flex justify-center items-center transition-colors ${history.length === 0 ? 'opacity-30 cursor-not-allowed text-[#5c5549]' : 'hover:bg-[#f0ece4] text-science-600'}`}>
              <Undo2 className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-sm font-bold text-[#866027] uppercase mb-3">{t('elements')}</h3>
          <div className="grid grid-cols-3 gap-2">
            {Object.keys(ElementType).map((el) => (
              <button
                key={el}
                onClick={() => setSelectedTool(el as ElementType)}
                className={`h-10 rounded-lg font-bold text-sm shadow-sm border transition-all
                   ${selectedTool === el
                     ? 'border-science-500 ring-2 ring-science-200 z-10 scale-105'
                     : 'border-[#e8d5b8] hover:bg-[#faf8f5] text-[#1a1a1a]'}`}
                style={{
                  backgroundColor: selectedTool === el ? 'white' : undefined,
                  color: selectedTool === el ? ELEMENT_COLORS[el] : undefined,
                }}
              >
                {el}
              </button>
            ))}
          </div>

          <h3 className="text-sm font-bold text-[#866027] uppercase mt-4 mb-3">{t('builderTemplates')}</h3>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.key}
                onClick={() => insertTemplate(tpl)}
                className="px-3 py-1.5 rounded-full text-xs font-mono border border-[#e8d5b8] hover:border-science-400 hover:text-science-700 transition-colors"
              >
                {tpl.key}
              </button>
            ))}
          </div>

          <button
            onClick={clearCanvas}
            className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#f0ece4] hover:bg-[#e8d5b8] text-sm font-medium text-[#5c5549] transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> {t('toolsTooltip.clear')}
          </button>
        </div>

        {/* Live formula */}
        <div className="bg-gradient-to-br from-science-50 to-white p-4 rounded-xl shadow-md border border-science-100">
          <h3 className="text-sm font-bold text-science-800 mb-2 flex items-center gap-2">
            <AtomIcon className="w-4 h-4" /> {t('builderLiveFormula')}
          </h3>
          {graph.formulaAscii ? (
            <>
              <div className="font-mono text-3xl text-science-800">{graph.formulaDisplay}</div>
              {graph.components > 1 && (
                <p className="mt-2 text-xs text-[#8C1515]">⚠ {t('fragmentsWarning', { count: graph.components })}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#a39a89] italic">—</p>
          )}
          <ul className="mt-3 text-xs text-[#5c5549] space-y-1.5 list-disc pl-4">
            <li>{t('chainHint')}</li>
          </ul>
        </div>

        {/* Instructions */}
        <div className="bg-white p-4 rounded-xl shadow-md border border-[#f0ece4] hidden lg:block">
          <h3 className="text-sm font-bold text-science-800 mb-2">{t('instructionsTitle')}</h3>
          <ul className="text-xs text-[#5c5549] space-y-2 list-disc pl-4">
            {instructions.map((inst, i) => (
              <li key={i}>{inst}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div
          className="flex-1 min-h-[320px] bg-white rounded-2xl shadow-inner border border-[#e8d5b8] relative overflow-hidden cursor-crosshair group"
          ref={canvasRef}
          onClick={handleCanvasClick}
        >
          <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded text-xs text-[#866027] font-mono pointer-events-none z-10">
            {t('canvasStats', { atoms: atoms.length, bonds: bonds.length })}
          </div>

          <svg className="w-full h-full pointer-events-none">
            {bonds.map((bond) => {
              const source = atoms.find((a) => a.id === bond.sourceId);
              const target = atoms.find((a) => a.id === bond.targetId);
              if (!source || !target) return null;
              const isSelected = selectedAtomId === source.id || selectedAtomId === target.id;
              return (
                <g key={bond.id}>
                  <line
                    x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                    stroke={isSelected ? '#8C1515' : '#D4A76A'} strokeWidth={bond.order * 3 + 2} opacity={0.3}
                  />
                  <line
                    x1={source.x} y1={source.y} x2={target.x} y2={target.y}
                    stroke={isSelected ? '#8C1515' : '#5c5549'} strokeWidth={bond.order === 1 ? 2 : bond.order * 2}
                  />
                  {bond.order > 1 && (
                    <text
                      x={(source.x + target.x) / 2} y={(source.y + target.y) / 2}
                      textAnchor="middle" dy={-5} fontSize="10" fill="#866027"
                    >
                      {bond.order === 2 ? '=' : '≡'}
                    </text>
                  )}
                </g>
              );
            })}
            {atoms.map((atom) => (
              <g key={atom.id} transform={`translate(${atom.x}, ${atom.y})`}>
                <circle
                  r={18} fill="white"
                  stroke={selectedAtomId === atom.id || lastAtomId === atom.id ? '#8C1515' : '#e8d5b8'}
                  strokeWidth={selectedAtomId === atom.id || lastAtomId === atom.id ? 3 : 1}
                />
                <circle r={14} fill={ELEMENT_COLORS[atom.element] || '#ccc'} opacity={0.2} />
                <text dy="5" textAnchor="middle" fontWeight="bold" fill="#1a1a1a" className="select-none">
                  {atom.element}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Controls & Results */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#f0ece4] p-6 flex flex-col md:flex-row gap-6 items-start shrink-0">
          <button
            onClick={() => void handleAnalyze()}
            disabled={analyzing || atoms.length === 0}
            className={`px-6 py-3 rounded-lg font-bold text-white shadow-md transition-all flex items-center gap-2 whitespace-nowrap
              ${analyzing || atoms.length === 0 ? 'bg-[#D4A76A] cursor-not-allowed' : 'bg-science-600 hover:bg-science-700 hover:shadow-lg'}`}
          >
            {analyzing ? <Loader2 className="animate-spin w-5 h-5" /> : <FlaskConical className="w-5 h-5" />}
            {analyzing ? t('analyzingBtn') : t('analyzeBtn')}
          </button>

          <div className="flex-1 w-full min-w-0">
            {identifyResult ? (
              <div className="animate-fade-in space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono text-2xl text-science-800">{identifyResult.formulaDisplay}</span>
                  {identifyResult.candidates.length > 0 ? (
                    <span className="px-2 py-0.5 bg-sand-light text-sand-dark text-xs rounded-full border border-sand/40 font-medium">
                      {t('officialMatch')}
                    </span>
                  ) : (
                    <span className="text-sm text-[#8a6116]">{t('noMatchHint')}</span>
                  )}
                </div>
                {identifyResult.candidates.length > 0 && (
                  <ul className="space-y-1.5">
                    {identifyResult.candidates.map((candidate) => (
                      <li key={candidate.cid} className="text-sm text-[#1a1a1a] flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{candidate.title ?? `CID ${candidate.cid}`}</span>
                        {candidate.iupacName && <span className="italic text-[#6f685d]">({candidate.iupacName})</span>}
                        <span className="text-xs text-[#a39a89]">CID {candidate.cid}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => void handleAiFallback()}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#e8d5b8] text-sm font-medium text-[#5c5549] hover:bg-[#faf8f5] transition-colors"
                >
                  {analyzing ? <Loader2 className="animate-spin w-4 h-4" /> : <Type className="w-4 h-4" />}
                  {t('aiFallbackBtn')}
                </button>
              </div>
            ) : aiResult ? (
              <div className="animate-fade-in space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-xl font-bold text-[#1a1a1a]">{aiResult.systematicName}</h4>
                  {aiResult.commonName && (
                    <span className="px-2 py-0.5 bg-sand-light text-sand-dark text-xs rounded-full border border-sand/40 font-medium">
                      {aiResult.commonName}
                    </span>
                  )}
                </div>
                <div className="p-3 bg-[#f5f0e8] rounded-lg border border-[#f0ece4] text-sm text-[#5c5549]">
                  <p>
                    <span className="font-semibold text-science-600">{t('ruleLogic')}:</span> {aiResult.explanation}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center text-[#6f685d] text-sm italic">
                <Info className="w-4 h-4 mr-2" />
                {t('buildMoleculeInfo')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
