import React, { useState, useRef, useEffect } from 'react';
import { BuilderAtom, BuilderBond, ElementType, ELEMENT_COLORS, ELEMENT_RADII } from '../types';
import { nameMoleculeFromGraph } from '../services/geminiService';
import { Trash2, MousePointer2, Type, Info, Check, RotateCcw, Loader2, Download } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const BuilderModule: React.FC = () => {
  const [atoms, setAtoms] = useState<BuilderAtom[]>([]);
  const [bonds, setBonds] = useState<BuilderBond[]>([]);
  const [selectedTool, setSelectedTool] = useState<'move' | 'bond' | 'delete' | ElementType>(ElementType.C);
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [namingResult, setNamingResult] = useState<{systematicName: string, commonName: string, explanation: string} | null>(null);
  const [isNaming, setIsNaming] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Logic based on tool
    if (selectedTool === 'move') {
        // Move logic is handled by drag, but click selects
        const clickedAtom = atoms.find(a => Math.hypot(a.x - x, a.y - y) < 20);
        setSelectedAtomId(clickedAtom ? clickedAtom.id : null);
    } else if (selectedTool === 'delete') {
         const clickedAtom = atoms.find(a => Math.hypot(a.x - x, a.y - y) < 20);
         if (clickedAtom) {
             setAtoms(prev => prev.filter(a => a.id !== clickedAtom.id));
             setBonds(prev => prev.filter(b => b.sourceId !== clickedAtom.id && b.targetId !== clickedAtom.id));
         }
         // Also check for bond clicks (distance to line segment)
         // Omitted for brevity in this click handler, focused on atoms
    } else if (selectedTool === 'bond') {
         const clickedAtom = atoms.find(a => Math.hypot(a.x - x, a.y - y) < 20);
         if (clickedAtom) {
             if (selectedAtomId && selectedAtomId !== clickedAtom.id) {
                 // Create bond
                 const existingBond = bonds.find(b => 
                    (b.sourceId === selectedAtomId && b.targetId === clickedAtom.id) ||
                    (b.targetId === selectedAtomId && b.sourceId === clickedAtom.id)
                 );
                 
                 if (existingBond) {
                     // Cycle order 1 -> 2 -> 3
                     setBonds(prev => prev.map(b => b.id === existingBond.id ? {...b, order: (b.order % 3) + 1} : b));
                 } else {
                     setBonds(prev => [...prev, {
                         id: generateId(),
                         sourceId: selectedAtomId,
                         targetId: clickedAtom.id,
                         order: 1
                     }]);
                 }
                 setSelectedAtomId(null); // Reset selection after bond
             } else {
                 setSelectedAtomId(clickedAtom.id);
             }
         } else {
             setSelectedAtomId(null);
         }
    } else {
        // Element tool - add atom
        // Check collision to avoid overlapping too much
        const collision = atoms.find(a => Math.hypot(a.x - x, a.y - y) < 20);
        if (!collision) {
            setAtoms(prev => [...prev, {
                id: generateId(),
                element: selectedTool as string,
                x,
                y,
                charge: 0
            }]);
        }
    }
  };

  const handleAnalyze = async () => {
      if (atoms.length === 0) return;
      setIsNaming(true);
      setNamingResult(null);
      try {
          const res = await nameMoleculeFromGraph(atoms, bonds, language);
          setNamingResult(res);
      } catch (e) {
          alert(t('failedToName'));
      } finally {
          setIsNaming(false);
      }
  };

  const clearCanvas = () => {
      setAtoms([]);
      setBonds([]);
      setNamingResult(null);
  };

  const instructions = t('instructions') as string[];

  return (
    <div className="flex h-full flex-col lg:flex-row gap-6 p-6">
       {/* Toolbar */}
       <div className="w-full lg:w-64 flex flex-col gap-4">
           <div className="bg-white p-4 rounded-xl shadow-md border border-slate-100">
               <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('tools')}</h3>
               <div className="grid grid-cols-4 gap-2 mb-4">
                   <button 
                    onClick={() => setSelectedTool('move')}
                    className={`p-2 rounded-lg flex justify-center items-center transition-colors ${selectedTool === 'move' ? 'bg-science-100 text-science-600' : 'hover:bg-slate-100 text-slate-600'}`} title={t('toolsTooltip.move')}>
                       <MousePointer2 className="w-5 h-5" />
                   </button>
                   <button 
                    onClick={() => setSelectedTool('bond')}
                    className={`p-2 rounded-lg flex justify-center items-center transition-colors ${selectedTool === 'bond' ? 'bg-science-100 text-science-600' : 'hover:bg-slate-100 text-slate-600'}`} title={t('toolsTooltip.bond')}>
                       <div className="w-5 h-0.5 bg-current rotate-45"></div>
                   </button>
                   <button 
                    onClick={() => setSelectedTool('delete')}
                    className={`p-2 rounded-lg flex justify-center items-center transition-colors ${selectedTool === 'delete' ? 'bg-red-100 text-red-600' : 'hover:bg-slate-100 text-slate-600'}`} title={t('toolsTooltip.delete')}>
                       <Trash2 className="w-5 h-5" />
                   </button>
                   <button 
                    onClick={clearCanvas}
                    className="p-2 rounded-lg flex justify-center items-center hover:bg-slate-100 text-slate-600 transition-colors" title={t('toolsTooltip.clear')}>
                       <RotateCcw className="w-5 h-5" />
                   </button>
               </div>

               <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">{t('elements')}</h3>
               <div className="grid grid-cols-3 gap-2">
                   {Object.keys(ElementType).map((el) => (
                       <button
                         key={el}
                         onClick={() => setSelectedTool(el as ElementType)}
                         className={`h-10 rounded-lg font-bold text-sm shadow-sm border transition-all
                            ${selectedTool === el 
                                ? 'border-science-500 ring-2 ring-science-200 z-10 scale-105' 
                                : 'border-slate-200 hover:bg-slate-50 text-slate-700'}`}
                         style={{ 
                             backgroundColor: selectedTool === el ? 'white' : undefined,
                             color: selectedTool === el ? ELEMENT_COLORS[el] : undefined 
                         }}
                       >
                           {el}
                       </button>
                   ))}
               </div>
           </div>
           
           <div className="bg-gradient-to-br from-science-50 to-white p-4 rounded-xl shadow-md border border-science-100">
               <h3 className="text-sm font-bold text-science-800 mb-2">{t('instructionsTitle')}</h3>
               <ul className="text-xs text-slate-600 space-y-2 list-disc pl-4">
                   {instructions.map((inst, i) => (
                       <li key={i}>{inst}</li>
                   ))}
               </ul>
           </div>
       </div>

       {/* Main Workspace */}
       <div className="flex-1 flex flex-col gap-6">
           {/* Canvas */}
           <div 
             className="flex-1 bg-white rounded-2xl shadow-inner border border-slate-200 relative overflow-hidden cursor-crosshair group"
             ref={canvasRef}
             onClick={handleCanvasClick}
           >
               <div className="absolute top-4 right-4 bg-white/80 backdrop-blur px-3 py-1 rounded text-xs text-slate-500 font-mono pointer-events-none">
                   {t('canvasStats', { atoms: atoms.length, bonds: bonds.length })}
               </div>
               
               <svg className="w-full h-full pointer-events-none">
                   {/* Render Bonds */}
                   {bonds.map(bond => {
                       const source = atoms.find(a => a.id === bond.sourceId);
                       const target = atoms.find(a => a.id === bond.targetId);
                       if (!source || !target) return null;
                       
                       const isSelected = selectedAtomId === source.id || selectedAtomId === target.id;
                       
                       return (
                           <g key={bond.id}>
                               <line 
                                 x1={source.x} y1={source.y} 
                                 x2={target.x} y2={target.y} 
                                 stroke={isSelected ? '#3b82f6' : '#94a3b8'} 
                                 strokeWidth={bond.order * 3 + 2} // visually wider
                                 opacity={0.3}
                               />
                               <line 
                                 x1={source.x} y1={source.y} 
                                 x2={target.x} y2={target.y} 
                                 stroke={isSelected ? '#3b82f6' : '#64748b'} 
                                 strokeWidth={bond.order === 1 ? 2 : (bond.order * 2)} 
                               />
                               {/* Label for double/triple bonds visual simplified */}
                               {bond.order > 1 && (
                                   <text x={(source.x+target.x)/2} y={(source.y+target.y)/2} textAnchor="middle" dy={-5} fontSize="10" fill="#64748b">
                                       {bond.order === 2 ? '=' : '≡'}
                                   </text>
                               )}
                           </g>
                       );
                   })}
                   
                   {/* Render Atoms */}
                   {atoms.map(atom => (
                       <g key={atom.id} transform={`translate(${atom.x}, ${atom.y})`}>
                           <circle 
                             r={18} 
                             fill="white" 
                             stroke={selectedAtomId === atom.id ? '#3b82f6' : '#cbd5e1'} 
                             strokeWidth={selectedAtomId === atom.id ? 3 : 1}
                             className="shadow-sm"
                           />
                           <circle r={14} fill={ELEMENT_COLORS[atom.element] || '#ccc'} opacity={0.2} />
                           <text 
                             dy="5" 
                             textAnchor="middle" 
                             fontWeight="bold" 
                             fill="#1e293b"
                             className="select-none"
                           >
                               {atom.element}
                           </text>
                       </g>
                   ))}
               </svg>
           </div>

           {/* Controls & Results */}
           <div className="min-h-[120px] bg-white rounded-2xl shadow-lg border border-slate-100 p-6 flex flex-col md:flex-row gap-6 items-start">
                <button
                    onClick={handleAnalyze}
                    disabled={isNaming || atoms.length === 0}
                    className={`px-6 py-3 rounded-lg font-bold text-white shadow-md transition-all flex items-center gap-2 whitespace-nowrap
                    ${isNaming || atoms.length === 0 ? 'bg-slate-300 cursor-not-allowed' : 'bg-science-600 hover:bg-science-700 hover:shadow-lg'}`}
                >
                    {isNaming ? <Loader2 className="animate-spin" /> : <Type className="w-5 h-5" />}
                    {t('analyzeBtn')}
                </button>

                <div className="flex-1 w-full">
                    {namingResult ? (
                        <div className="animate-fade-in space-y-2">
                             <div className="flex items-center gap-2">
                                <h4 className="text-xl font-bold text-slate-800">{namingResult.systematicName}</h4>
                                {namingResult.commonName && (
                                    <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full border border-yellow-200 font-medium">
                                        {namingResult.commonName}
                                    </span>
                                )}
                             </div>
                             <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm text-slate-600">
                                 <p><span className="font-semibold text-science-600">{t('ruleLogic')}:</span> {namingResult.explanation}</p>
                             </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center text-slate-400 text-sm italic">
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