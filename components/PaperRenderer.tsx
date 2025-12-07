import React, { useState, useEffect, useRef } from 'react';
import { ExamPaperData, Question, ContentPart, GridConfig, SchoolConfig } from '../types';
import { 
    Image as ImageIcon, GripVertical, RotateCcw, MousePointerClick, 
    LayoutList, LayoutGrid, Grid3X3, Plus, Minus, Hash,
    Maximize2, ArrowLeftRight, ArrowUpDown, ChevronLeft, ChevronRight,
    PenTool
} from 'lucide-react';

// IMPORT YOUR EDITOR
import { DiagramEditor } from '@/lib/DiagramEditor';

interface PaperRendererProps {
  config: SchoolConfig;
  data: ExamPaperData | null;
  onUpdateData: (newData: ExamPaperData) => void;
}

interface ImageState {
    isDrawn: boolean;
    seed: number;
}

type LayoutMode = 'list' | 'grid-2' | 'grid-3';
type NumberingMode = 'continuous' | 'per_section';
type SizeMode = 'sm' | 'md' | 'lg';
type DensityMode = 'compact' | 'standard' | 'relaxed';

// --- COMPONENT: INLINE EDIT ---
const InlineEdit = ({ value, onSave, className = "", multiline = false }: { value: string, onSave: (val: string) => void, className?: string, multiline?: boolean }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (multiline) {
                inputRef.current.style.height = '0px';
                inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
            }
        }
    }, [isEditing, tempValue, multiline]);

    const handleBlur = () => {
        setIsEditing(false);
        if (tempValue.trim() !== value) onSave(tempValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleBlur();
        }
    };

    const baseEditStyles = `w-full border-b-2 border-blue-400 outline-none m-0 p-0 text-inherit font-inherit leading-inherit block bg-transparent ${className}`;

    if (isEditing) {
        return multiline ? (
            <textarea
                ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={`resize-none overflow-hidden ${baseEditStyles}`}
                rows={1}
            />
        ) : (
            <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className={baseEditStyles}
            />
        );
    }

    return (
        <span 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTempValue(value); setIsEditing(true); }}
            className={`cursor-text hover:bg-yellow-50 hover:outline hover:outline-1 hover:outline-gray-300 rounded px-1 -ml-1 transition-colors duration-200 decoration-clone ${className}`}
            title="Click to edit"
        >
            {value}
        </span>
    );
};

export const PaperRenderer: React.FC<PaperRendererProps> = ({ config, data, onUpdateData }) => {
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [draggedItem, setDraggedItem] = useState<{ sIdx: number; qIdx: number } | null>(null);
  const [sectionLayouts, setSectionLayouts] = useState<Record<number, LayoutMode>>({});
  const [numberingMode, setNumberingMode] = useState<NumberingMode>('continuous');
  
  // Sizing States
  const [itemSizes, setItemSizes] = useState<Record<string, SizeMode>>({});
  const [tableColWeights, setTableColWeights] = useState<Record<string, number[]>>({});
  const [tableRowHeights, setTableRowHeights] = useState<Record<string, Record<number, number>>>({});
  const [tableDensities, setTableDensities] = useState<Record<string, DensityMode>>({});

  // NEW: State for the Diagram Editor Modal
  const [editingDiagram, setEditingDiagram] = useState<{
      sIdx: number;
      qIdx: number;
      pIdx: number; // -1 for reference
      content: string;
      isReference: boolean;
  } | null>(null);

  if (!data || !data.sections) return null;

  // --- SIZE HELPERS ---
  const setSpecificSize = (key: string, size: SizeMode) => setItemSizes(prev => ({ ...prev, [key]: size }));
  const setSpecificDensity = (key: string, density: DensityMode) => setTableDensities(prev => ({ ...prev, [key]: density }));
  const toggleSize = (key: string) => {
      setItemSizes(prev => {
          const current = prev[key] || 'md';
          const next = current === 'sm' ? 'md' : current === 'md' ? 'lg' : 'sm';
          return { ...prev, [key]: next };
      });
  };

  const adjustColWeight = (tableKey: string, colIdx: number, delta: number, totalCols: number) => {
      setTableColWeights(prev => {
          const currentWeights = prev[tableKey] || Array(totalCols).fill(1);
          const newWeights = [...currentWeights];
          newWeights[colIdx] = Math.max(0.2, (newWeights[colIdx] || 1) + delta);
          return { ...prev, [tableKey]: newWeights };
      });
  };

  const adjustRowHeight = (tableKey: string, rowIdx: number, delta: number) => {
      setTableRowHeights(prev => {
          const tableHeights = prev[tableKey] || {};
          const currentHeight = tableHeights[rowIdx] || 0;
          return { ...prev, [tableKey]: { ...tableHeights, [rowIdx]: Math.max(0, currentHeight + delta) } };
      });
  };

  const getSizeClass = (key: string, type: 'image' | 'grid' | 'table' | 'reference') => {
      const size = itemSizes[key] || 'md';
      
      if (type === 'image') {
          if (size === 'sm') return { width: '80px', height: '80px', minWidth: '80px', minHeight: '80px' };
          if (size === 'lg') return { width: '200px', height: '200px', minWidth: '200px', minHeight: '200px' };
          return { width: '120px', height: '120px', minWidth: '120px', minHeight: '120px' };
      }
      if (type === 'reference') {
          if (size === 'sm') return { width: '120px', maxWidth: '120px' };
          if (size === 'lg') return { width: '300px', maxWidth: '300px' };
          return { width: '180px', maxWidth: '180px' };
      }
      if (type === 'grid') {
          if (size === 'sm') return "w-8 h-6";
          if (size === 'lg') return "w-16 h-12";
          return "w-10 h-8";
      }
      if (type === 'table') {
          if (size === 'sm') return "w-[50%]"; 
          if (size === 'md') return "w-[75%]"; 
          return "w-full"; 
      }
      return {};
  };

  const getDensityClass = (key: string) => {
      const density = tableDensities[key] || 'standard';
      if (density === 'compact') return 'py-1'; 
      if (density === 'relaxed') return 'py-6'; 
      return 'py-2';
  };

  // --- DATA UPDATERS ---
  const renumberQuestions = (currentData: ExamPaperData, mode: NumberingMode) => {
      const newData = JSON.parse(JSON.stringify(currentData));
      let globalCount = 1;
      newData.sections.forEach((sec: any) => {
          let sectionCount = 1; 
          if (sec.questions) {
              sec.questions.forEach((q: any) => {
                  q.question_number = mode === 'continuous' ? globalCount++ : sectionCount++;
              });
          }
      });
      return newData;
  };

  const handleNumberingSwitch = () => {
      const newMode = numberingMode === 'continuous' ? 'per_section' : 'continuous';
      setNumberingMode(newMode);
      const updatedData = renumberQuestions(data, newMode);
      onUpdateData(updatedData);
  };

  const updateSectionHeading = (sIdx: number, newVal: string) => {
      const newData = JSON.parse(JSON.stringify(data));
      newData.sections[sIdx].heading = newVal;
      onUpdateData(newData);
  };

  const updateContentPart = (sIdx: number, qIdx: number, pIdx: number, newVal: string, isMatchLeft = false, isMatchRight = false) => {
      const newData = JSON.parse(JSON.stringify(data));
      if (isMatchLeft) newData.sections[sIdx].questions[qIdx].match_pair.left.value = newVal;
      else if (isMatchRight) newData.sections[sIdx].questions[qIdx].match_pair.right.value = newVal;
      else newData.sections[sIdx].questions[qIdx].content_parts[pIdx].value = newVal;
      onUpdateData(newData);
  };

  const updateTableData = (sIdx: number, qIdx: number, pIdx: number, rowIndex: number, colIndex: number, newVal: string, isHeader: boolean) => {
    const newData = JSON.parse(JSON.stringify(data));
    const tableData = newData.sections[sIdx].questions[qIdx].content_parts[pIdx].table_data;
    if (isHeader) tableData.headers[colIndex] = newVal;
    else tableData.rows[rowIndex][colIndex] = newVal;
    onUpdateData(newData);
  };

  const updateAnswerLines = (sIdx: number, qIdx: number, change: number) => {
      const newData = JSON.parse(JSON.stringify(data));
      const q = newData.sections[sIdx].questions[qIdx];
      q.answer_lines = Math.max(0, (q.answer_lines || 0) + change); 
      onUpdateData(newData);
  };

  const handleDragStart = (sIdx: number, qIdx: number) => setDraggedItem({ sIdx, qIdx });
  const handleDragEnd = () => setDraggedItem(null);
  
  const handleDragEnter = (targetSIdx: number, targetQIdx: number) => {
      if (!draggedItem || draggedItem.sIdx !== targetSIdx || draggedItem.qIdx === targetQIdx) return;
      const tempData = JSON.parse(JSON.stringify(data));
      const section = tempData.sections[targetSIdx];
      if (!section.questions) return;
      const item = section.questions.splice(draggedItem.qIdx, 1)[0];
      section.questions.splice(targetQIdx, 0, item);
      const finalData = renumberQuestions(tempData, numberingMode);
      setDraggedItem({ sIdx: targetSIdx, qIdx: targetQIdx });
      onUpdateData(finalData);
  };

  // --- DIAGRAM EDITOR LOGIC ---
  const handleOpenEditor = (sIdx: number, qIdx: number, pIdx: number, isReference: boolean, content: string, type: 'image' | 'svg', uniqueKey: string) => {
      let finalContent = content;
      setEditingDiagram({ sIdx, qIdx, pIdx, isReference, content: finalContent });
  };

  const handleSaveDiagram = (newContent: string) => {
      if (!editingDiagram) return;
      const { sIdx, qIdx, pIdx, isReference } = editingDiagram;
      const newData = JSON.parse(JSON.stringify(data));
      
      // Update data based on where it came from
      if (isReference) {
          newData.sections[sIdx].questions[qIdx].content_parts[pIdx].reference.value = newContent;
          newData.sections[sIdx].questions[qIdx].content_parts[pIdx].reference.type = 'svg'; 
      } else {
          newData.sections[sIdx].questions[qIdx].content_parts[pIdx].value = newContent;
          newData.sections[sIdx].questions[qIdx].content_parts[pIdx].type = 'svg'; 
      }
      
      onUpdateData(newData);
      setEditingDiagram(null);
  };

  // --- IMAGE HELPERS ---
  const getImageState = (key: string) => imageStates[key] || { isDrawn: false, seed: Math.floor(Math.random() * 1000) };
  const handleDraw = (key: string) => setImageStates(prev => ({ ...prev, [key]: { isDrawn: true, seed: prev[key]?.seed || Math.floor(Math.random() * 1000) } }));
  const handleRedraw = (key: string) => setImageStates(prev => ({ ...prev, [key]: { isDrawn: true, seed: Math.floor(Math.random() * 10000) } }));
  const getPollinationsUrl = (prompt: string, seed: number) => `https://image.pollinations.ai/prompt/${encodeURIComponent(`${prompt}, simple vector line art, coloring book style, black and white, white background, no shading, educational illustration`)}?width=512&height=512&nologo=true&seed=${seed}&model=flux`;
  const toggleLayout = (sIdx: number, mode: LayoutMode) => setSectionLayouts(prev => ({ ...prev, [sIdx]: mode }));

  // --- RENDERERS ---
  
  // 1. Render Reference (Float Left) with Edit Button
  const renderReference = (ref: { type: 'image' | 'svg', value: string }, uniqueKey: string, sIdx: number, qIdx: number, pIdx: number) => {
    const sizeStyle = getSizeClass(uniqueKey, 'reference');
    let content = null;
    
    if (ref.type === 'svg') {
         content = <div className="w-full leading-none block line-height-[0]" dangerouslySetInnerHTML={{ __html: ref.value }} />;
    } else {
        const state = getImageState(uniqueKey);
        content = state.isDrawn ? (
            <>
                <img src={getPollinationsUrl(ref.value, state.seed)} alt="Reference" className="border border-gray-200 shadow-sm rounded bg-white mb-1 object-contain w-full" style={{ height: 'auto', minHeight: '100px' }} />
                <button onClick={() => handleRedraw(uniqueKey)} className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1 transition-colors no-print"><RotateCcw className="w-3 h-3" /> Redraw</button>
            </>
        ) : (
            <div className="flex flex-col items-center w-full">
                <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 bg-gray-50 mb-2 px-2 text-center">
                    <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-[9px] leading-tight line-clamp-3">{ref.value}</span>
                </div>
                <button onClick={() => handleDraw(uniqueKey)} className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded flex items-center gap-1 transition-colors no-print font-medium"><MousePointerClick className="w-3 h-3" /> Draw Diagram</button>
            </div>
        );
    }
    return (
        <div className="float-left border border-gray-100 p-2 rounded bg-white mr-4 mb-2 break-inside-avoid relative group/ref" style={sizeStyle}>
             {/* EDIT + RESIZE CONTROLS */}
             <div className="absolute top-1 right-1 z-10 opacity-0 group-hover/ref:opacity-100 transition-opacity no-print flex gap-1">
                {/* EDIT BUTTON - ONLY FOR SVG */}
                {ref.type === 'svg' && (
                    <button 
                        onClick={() => handleOpenEditor(sIdx, qIdx, pIdx, true, ref.value, ref.type, uniqueKey)} 
                        className="bg-white/90 text-blue-600 p-1 rounded-full shadow border border-blue-200 hover:text-blue-800" 
                        title="Edit Diagram"
                    >
                        <PenTool className="w-3 h-3" />
                    </button>
                )}
                <button onClick={() => toggleSize(uniqueKey)} className="bg-white/90 text-gray-600 p-1 rounded-full shadow border border-gray-200 hover:text-blue-600" title="Resize"><Maximize2 className="w-3 h-3" /></button>
            </div>
            {content}
        </div>
    );
  };

  const renderContentPart = (part: ContentPart, uniqueKey: string, sIdx: number, qIdx: number, pIdx: number) => {
    if (!part) return null;

    let contentElement: React.ReactNode = null;

    if (part.type === 'text') {
        const text = part.value || '';
        if (text.trim()) {
             if (/^\(?\s*OR\s*\)?$/i.test(text.trim())) {
                contentElement = <div className="w-full text-center font-bold text-gray-500 my-3 text-sm tracking-widest border-t border-b border-gray-100 py-1 break-inside-avoid">— {text} —</div>;
             } else {
                contentElement = <InlineEdit value={text} onSave={(val) => updateContentPart(sIdx, qIdx, pIdx, val)} className="mr-1 align-baseline text-sm leading-relaxed" multiline />;
             }
        }
    }
    
    // 2. Render Inline Image
    else if (part.type === 'image') {
        const state = getImageState(uniqueKey);
        const boxStyle = getSizeClass(uniqueKey, 'image');
        contentElement = (
            <div className="inline-flex flex-col items-center m-2 align-middle group/image relative break-inside-avoid">
                <div className="absolute top-1 right-1 z-10 opacity-0 group-hover/image:opacity-100 transition-opacity no-print flex gap-1">
                    {/* ONLY RESIZE BUTTON FOR IMAGES - NO EDIT */}
                    <button onClick={() => toggleSize(uniqueKey)} className="bg-white/90 text-gray-600 p-1 rounded-full shadow border border-gray-200 hover:text-blue-600" title="Toggle Size"><Maximize2 className="w-3 h-3" /></button>
                </div>
                {state.isDrawn ? (
                    <>
                        <img src={getPollinationsUrl(part.value, state.seed)} alt={part.value} className="border border-gray-100 rounded object-contain bg-white" style={boxStyle} />
                        <button onClick={() => handleRedraw(uniqueKey)} className="absolute -bottom-4 text-[9px] text-blue-500 opacity-0 group-hover/image:opacity-100 no-print bg-white shadow px-1 rounded border">Redraw</button>
                    </>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 bg-gray-50 mb-1 px-2 text-center" style={boxStyle}>
                            <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                            <span className="text-[8px] leading-tight line-clamp-3 font-medium">{part.value}</span>
                        </div>
                        <button onClick={() => handleDraw(uniqueKey)} className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded flex items-center gap-1 font-medium transition-colors"><MousePointerClick className="w-3 h-3" /> Draw</button>
                    </div>
                )}
            </div>
        );
    }
    
    else if (part.type === 'table' && part.table_data) {
        const tableClass = getSizeClass(uniqueKey, 'table');
        const colWeights = tableColWeights[uniqueKey] || Array(part.table_data.headers.length).fill(1);
        const totalWeight = colWeights.reduce((a, b) => a + b, 0);
        const rowHeights = tableRowHeights[uniqueKey] || {};
        const paddingClass = getDensityClass(uniqueKey);

        contentElement = (
            <div className={`my-4 relative group/table ${tableClass as string}`}>
                 <div className="absolute -top-7 right-0 z-30 opacity-0 group-hover/table:opacity-100 transition-opacity no-print flex gap-2">
                    <div className="bg-white border border-gray-300 rounded shadow-sm flex text-[10px] overflow-hidden">
                         <div className="px-1.5 py-0.5 bg-gray-50 border-r border-gray-200 text-gray-500 flex items-center"><ArrowLeftRight className="w-3 h-3 mr-1"/>W</div>
                         <button onClick={() => setSpecificSize(uniqueKey, 'sm')} className="px-2 py-0.5 hover:bg-blue-50 text-gray-700 border-r border-gray-100">S</button>
                         <button onClick={() => setSpecificSize(uniqueKey, 'md')} className="px-2 py-0.5 hover:bg-blue-50 text-gray-700 border-r border-gray-100">M</button>
                         <button onClick={() => setSpecificSize(uniqueKey, 'lg')} className="px-2 py-0.5 hover:bg-blue-50 text-gray-700">L</button>
                    </div>
                    <div className="bg-white border border-gray-300 rounded shadow-sm flex text-[10px] overflow-hidden">
                         <div className="px-1.5 py-0.5 bg-gray-50 border-r border-gray-200 text-gray-500 flex items-center"><ArrowUpDown className="w-3 h-3 mr-1"/>H</div>
                         <button onClick={() => setSpecificDensity(uniqueKey, 'compact')} className="px-2 py-0.5 hover:bg-blue-50 text-gray-700 border-r border-gray-100">S</button>
                         <button onClick={() => setSpecificDensity(uniqueKey, 'standard')} className="px-2 py-0.5 hover:bg-blue-50 text-gray-700 border-r border-gray-100">M</button>
                         <button onClick={() => setSpecificDensity(uniqueKey, 'relaxed')} className="px-2 py-0.5 hover:bg-blue-50 text-gray-700">L</button>
                    </div>
                </div>

                <div className="overflow-x-auto pl-6">
                    <table className="w-full border-collapse border border-black text-sm table-fixed">
                        <colgroup>
                            {colWeights.map((w, i) => (
                                <col key={i} style={{ width: `${(w / totalWeight) * 100}%` }} />
                            ))}
                        </colgroup>
                        <thead>
                            <tr>
                                {part.table_data.headers.map((h, i) => (
                                    <th key={i} className={`border border-black px-3 ${paddingClass} bg-gray-50 text-center font-bold relative group/col align-middle`}>
                                        <div className="absolute inset-y-0 right-0 flex items-center opacity-0 group-hover/col:opacity-100 no-print z-20">
                                            <div className="flex flex-col bg-white border border-gray-300 shadow-sm rounded-l">
                                                <button onClick={(e) => { e.stopPropagation(); adjustColWeight(uniqueKey, i, -0.2, part.table_data!.headers.length); }} className="px-1 hover:bg-gray-100 text-gray-600 text-[8px] border-b border-gray-200"><ChevronLeft className="w-3 h-3"/></button>
                                                <button onClick={(e) => { e.stopPropagation(); adjustColWeight(uniqueKey, i, 0.2, part.table_data!.headers.length); }} className="px-1 hover:bg-gray-100 text-gray-600 text-[8px]"><ChevronRight className="w-3 h-3"/></button>
                                            </div>
                                        </div>
                                        <InlineEdit value={h} onSave={(val) => updateTableData(sIdx, qIdx, pIdx, -1, i, val, true)} className="text-center font-bold bg-transparent relative z-10" />
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {part.table_data.rows.map((row, rIdx) => {
                                const extraHeight = rowHeights[rIdx] || 0;
                                return (
                                    <tr key={rIdx} className="group/row">
                                        {row.map((cell, cIdx) => (
                                            <td key={cIdx} className="border border-black px-3 text-center align-middle relative" style={{ height: `${24 + extraHeight}px`, padding: paddingClass === 'py-6' ? '1.5rem 0.75rem' : paddingClass === 'py-1' ? '0.25rem 0.75rem' : '0.5rem 0.75rem' }}>
                                                {cIdx === 0 && (
                                                    <div className="absolute top-0 left-0 -ml-6 h-full flex flex-col justify-center opacity-0 group-hover/row:opacity-100 no-print z-20 w-5">
                                                        <button onClick={() => adjustRowHeight(uniqueKey, rIdx, 10)} className="w-5 h-5 bg-blue-50 border border-blue-200 rounded-t flex items-center justify-center hover:bg-blue-100 mb-[1px]"><Plus className="w-3 h-3 text-blue-600" /></button>
                                                        <button onClick={() => adjustRowHeight(uniqueKey, rIdx, -10)} className="w-5 h-5 bg-red-50 border border-red-200 rounded-b flex items-center justify-center hover:bg-red-100"><Minus className="w-3 h-3 text-red-600" /></button>
                                                    </div>
                                                )}
                                                <InlineEdit value={cell} onSave={(val) => updateTableData(sIdx, qIdx, pIdx, rIdx, cIdx, val, false)} className="text-center bg-transparent relative z-10" />
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
    
    // 3. Render Inline SVG with Edit Button
    else if (part.type === 'svg') {
        contentElement = (
            <div className="inline-block align-middle my-2 relative group/svg leading-none">
                <div className="absolute -top-3 right-0 opacity-0 group-hover/svg:opacity-100 transition-opacity no-print z-10 flex gap-1">
                    <button 
                        onClick={() => handleOpenEditor(sIdx, qIdx, pIdx, false, part.value, 'svg', uniqueKey)}
                        className="bg-white/90 text-blue-600 p-1 rounded-full shadow border border-blue-200 hover:text-blue-800" 
                        title="Edit SVG"
                    >
                        <PenTool className="w-3 h-3" />
                    </button>
                </div>
                <span className="block leading-none" dangerouslySetInnerHTML={{ __html: part.value }} />
            </div>
        );
    }

    if (part.reference) {
        return (
            <div className="flow-root w-full">
                {renderReference(part.reference, `${uniqueKey}-ref`, sIdx, qIdx, pIdx)}
                <div className="leading-relaxed">
                    {contentElement}
                </div>
            </div>
        );
    }

    return contentElement;
  };

  const renderGrid = (config: GridConfig, uniqueKey: string) => {
    const sizeClass = getSizeClass(uniqueKey, 'grid');
    return (
        <div className="mt-2 border-l border-t border-black inline-block break-inside-avoid relative group/grid">
             <div className="absolute -top-6 left-0 z-10 opacity-0 group-hover/grid:opacity-100 transition-opacity no-print">
                <button onClick={() => toggleSize(uniqueKey)} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] shadow border border-gray-200 hover:bg-gray-200">
                    Grid Size
                </button>
            </div>
            {Array.from({ length: config.rows }).map((_, r) => (
                <div key={r} className="flex">
                    {Array.from({ length: config.cols }).map((_, c) => (
                        <div key={c} className={`${sizeClass} border-r border-b border-black`}></div>
                    ))}
                </div>
            ))}
        </div>
    );
  };

  const renderMCQ = (options: ContentPart[], baseKey: string, sIdx: number, qIdx: number) => (
    <div className="flex flex-wrap gap-4 mt-1 justify-start items-center">
        {options.map((opt, i) => {
            const textContent = opt.type === 'text' ? opt.value.trim() : '';
            const hasLabel = /^[a-zA-Z0-9]+[.)]/.test(textContent);
            return (
                <div key={i} className="flex items-center gap-2">
                    {!hasLabel && (
                        <div className="rounded-full cursor-pointer hover:bg-gray-100 flex-shrink-0 border-2 border-gray-400 print:border-black flex items-center justify-center" style={{ width: '18px', height: '18px', minWidth: '18px', minHeight: '18px' }}>&nbsp;</div>
                    )}
                    <div>{renderContentPart(opt, `${baseKey}-opt-${i}`, sIdx, qIdx, -1)}</div>
                </div>
            );
        })}
    </div>
  );

  const renderAnswerLines = (count: number, sIdx: number, qIdx: number) => (
    <div className="w-full mt-2 mb-2 break-inside-avoid relative group/lines">
        <div className="absolute -right-2 top-0 flex flex-col gap-1 opacity-0 group-hover/lines:opacity-100 transition-opacity no-print z-10">
            <button onClick={() => updateAnswerLines(sIdx, qIdx, 1)} className="bg-green-100 text-green-700 p-1 rounded hover:bg-green-200 shadow border border-green-300" title="Add Line"><Plus className="w-3 h-3" /></button>
            <button onClick={() => updateAnswerLines(sIdx, qIdx, -1)} className="bg-red-100 text-red-700 p-1 rounded hover:bg-red-200 shadow border border-red-300" title="Remove Line"><Minus className="w-3 h-3" /></button>
        </div>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-end h-8 mb-1 w-full">
                {i === 0 && <span className="font-bold mr-2 text-sm text-gray-800 shrink-0 mb-1">Ans:</span>}
                {i > 0 && <span className="w-10 shrink-0"></span>} 
                <div className="flex-1 border-b-2 border-black border-dotted"></div>
            </div>
        ))}
    </div>
  );

  const renderVerticalMath = (config: any) => {
    if (!config) return null;
    if (config.subtype === 'division') {
        return (
            <div className="inline-flex items-center font-mono text-xl tracking-widest mx-4 my-4 break-inside-avoid">
                <span className="mr-1 font-bold">{config.divisor}</span>
                <span className="text-2xl font-light leading-none transform scale-y-110">)</span>
                <span className="border-t-2 border-black px-3 ml-1 font-bold">{config.dividend}</span>
            </div>
        );
    }
    if (config.subtype === 'stack' && config.values) {
        const { values, operator } = config;
        const maxLength = Math.max(...values.map((v: string) => v.length));
        const headers = maxLength === 3 ? ['H','T','O'] : maxLength === 4 ? ['Th','H','T','O'] : [];
        return (
            <div className="inline-block px-6 py-2 align-top break-inside-avoid">
                {headers.length > 0 && (
                    <div className="flex justify-end gap-4 mb-1 text-gray-400 font-bold text-[10px]">
                        {headers.map((h: string, i: number) => <div key={i} className="w-4 text-center">{h}</div>)}
                    </div>
                )}
                <div className="flex flex-col items-end">
                    {values.map((val: string, i: number) => (
                        <div key={i} className="flex items-center gap-4 relative">
                            {i === values.length - 1 && <span className="absolute -left-8 font-bold text-lg">{operator}</span>}
                            <div className="flex gap-4 justify-end font-mono text-lg tracking-widest font-semibold">
                                {val.split('').map((digit: string, dIdx: number) => <div key={dIdx} className="w-4 text-center">{digit}</div>)}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="border-t-2 border-black mt-2 pt-1 w-full mb-2"></div> 
                <div className="border-t-2 border-black w-full"></div>
                <div className="h-8 w-full"></div>
            </div>
        );
    }
    return null;
  };

  const renderMatchFollowing = (questions: Question[], sIdx: number) => {
    return (
        <div className="mt-4 px-2">
            {questions.map((q, qIdx) => {
                const rightText = q.match_pair?.right?.type === 'text' ? q.match_pair.right.value.trim() : "";
                const hasLabel = /^[a-zA-Z0-9]+[.)]/.test(rightText); 
                return (
                    <div key={qIdx} className={`flex items-center justify-between py-2 border-b border-gray-100 last:border-0 group relative break-inside-avoid`} draggable onDragStart={() => handleDragStart(sIdx, qIdx)} onDragEnter={() => handleDragEnter(sIdx, qIdx)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}>
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 cursor-move no-print"><GripVertical className="w-4 h-4" /></div>
                        <div className="w-[45%] flex items-center justify-start gap-3 pr-2">
                            <span className="font-bold min-w-[20px] text-sm">{q.question_number}.</span>
                            <div className="flex-1">
                                {q.match_pair?.left && renderContentPart(q.match_pair.left, `s${sIdx}-q${qIdx}-left`, sIdx, qIdx, -1)}
                            </div>
                        </div>
                        <div className="w-[10%] flex justify-center items-center">
                            {hasLabel && <span className="font-bold font-mono text-lg text-gray-800 whitespace-nowrap">( &nbsp;&nbsp; )</span>}
                        </div>
                        <div className="w-[45%] flex items-center justify-start gap-3 pl-4">
                            <div className="flex-1">
                                {q.match_pair?.right && renderContentPart(q.match_pair.right, `s${sIdx}-q${qIdx}-right`, sIdx, qIdx, -1)}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  return (
    <div id="exam-paper-content" className="print-container w-full max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none min-h-[297mm] p-[10mm] text-black font-serif leading-normal relative">
      <div className="border-b-2 border-black pb-4 mb-6 relative">
         {/* ... Controls ... */}
         <div className="absolute top-0 right-0 flex gap-2 no-print transform -translate-y-full pb-2">
             <button onClick={handleNumberingSwitch} className="flex items-center gap-2 bg-gray-800 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow hover:bg-gray-700 transition-colors">
                <Hash className="w-3 h-3" />
                {numberingMode === 'continuous' ? 'Continuous (1-50)' : 'Per Section (1-10, 1-10)'}
             </button>
         </div>
         {/* ... Header ... */}
         <div className="flex items-center justify-between gap-4 mb-2">
            <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center overflow-hidden">
                 {config.logoUrl ? <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <div className="w-full h-full border border-dashed border-gray-300 rounded flex items-center justify-center text-[10px] text-gray-300 no-print">LOGO</div>}
            </div>
            <div className="flex-grow text-center">
                <h1 className="text-2xl font-bold uppercase tracking-wide mb-1">{config.schoolName}</h1>
                <div className="inline-block px-3 py-0.5 border border-black text-sm font-bold uppercase bg-gray-50">{config.examName}</div>
            </div>
            <div className="w-20 flex-shrink-0"></div>
        </div>
        <div className="mt-4 border border-black text-sm">
            <div className="flex border-b border-black divide-x divide-black">
                <div className="flex-1 p-1 px-2 flex items-center"><span className="font-bold mr-2">Class:</span>{config.className}</div>
                <div className="flex-1 p-1 px-2 flex items-center"><span className="font-bold mr-2">Subject:</span>{config.subject}</div>
            </div>
            <div className="flex border-b border-black divide-x divide-black">
                <div className="flex-1 p-1 px-2 flex items-center"><span className="font-bold mr-2">Time:</span>{config.time}</div>
                <div className="flex-1 p-1 px-2 flex items-center"><span className="font-bold mr-2">Marks:</span>{config.marks}</div>
                 <div className="flex-1 p-1 px-2 flex items-center"><span className="font-bold mr-2">Date:</span>{config.date}</div>
            </div>
             <div className="flex p-1 px-2 items-center"><span className="font-bold mr-2">Name:</span><span className="flex-1 border-b border-dotted border-black h-4"></span></div>
        </div>
      </div>

      <div className="exam-content space-y-6">
        {data.sections?.map((section, sIdx) => {
          const currentLayout = sectionLayouts[sIdx] || 'list';
          return (
            <div key={sIdx}>
              <div className="flex justify-between items-baseline mb-3 section-header group">
                 <div className="flex items-center gap-4 flex-grow">
                    <h3 className="font-bold text-lg uppercase tracking-wide flex-grow">
                        <InlineEdit value={section.heading} onSave={(val) => updateSectionHeading(sIdx, val)} className="font-bold uppercase" multiline={true} />
                    </h3>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print flex-shrink-0">
                        <button onClick={() => toggleLayout(sIdx, 'list')} className={`p-1 rounded ${currentLayout === 'list' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}><LayoutList className="w-4 h-4" /></button>
                        <button onClick={() => toggleLayout(sIdx, 'grid-2')} className={`p-1 rounded ${currentLayout === 'grid-2' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}><LayoutGrid className="w-4 h-4" /></button>
                        <button onClick={() => toggleLayout(sIdx, 'grid-3')} className={`p-1 rounded ${currentLayout === 'grid-3' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}><Grid3X3 className="w-4 h-4" /></button>
                    </div>
                 </div>
                 <span className="font-bold text-sm whitespace-nowrap ml-4">{section.marks}</span>
              </div>

              {section.section_type === 'match_following' ? (
                  section.questions && renderMatchFollowing(section.questions, sIdx)
              ) : (
                  <div className={`space-y-4 ${currentLayout === 'grid-2' ? 'grid grid-cols-2 gap-4 space-y-0' : ''} ${currentLayout === 'grid-3' ? 'grid grid-cols-3 gap-4 space-y-0' : ''}`}>
                    {section.questions?.map((q, qIdx) => (
                      <div key={qIdx} className={`question-block relative group p-1 rounded transition-colors h-full ${draggedItem?.sIdx === sIdx && draggedItem?.qIdx === qIdx ? 'bg-gray-100 opacity-50' : 'hover:bg-gray-50'}`} draggable onDragStart={() => handleDragStart(sIdx, qIdx)} onDragEnter={() => handleDragEnter(sIdx, qIdx)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}>
                        <div className="absolute -left-4 top-1 text-gray-400 opacity-0 group-hover:opacity-100 cursor-move no-print"><GripVertical className="w-4 h-4" /></div>
                        <div className="flex gap-2">
                            <div className="font-bold min-w-[24px] text-sm pt-0.5">{q.question_number}.</div>
                            <div className="flex-1">
                              <div className="mb-1 leading-relaxed">
                                  {(q.content_parts || []).map((part, pIdx) => (
                                      <React.Fragment key={pIdx}>{renderContentPart(part, `s${sIdx}-q${qIdx}-p${pIdx}`, sIdx, qIdx, pIdx)}</React.Fragment>
                                  ))}
                                  <div className="clear-both"></div>
                              </div>
                              {q.answer_type === 'grid' && q.grid_config && renderGrid(q.grid_config, `s${sIdx}-q${qIdx}-grid`)}
                              {q.answer_type === 'mcq' && q.options && renderMCQ(q.options, `s${sIdx}-q${qIdx}`, sIdx, qIdx)}
                              {q.answer_type === 'vertical_math' && q.vertical_math_config && renderVerticalMath(q.vertical_math_config)}
                            </div>
                        </div>
                        {(q.answer_lines || 0) > 0 && renderAnswerLines(q.answer_lines!, sIdx, qIdx)}
                      </div>
                    ))}
                  </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="w-full text-center text-[10px] text-gray-400 mt-12 pb-4 print:text-black">Generated by ExamGen AI</div>
      
      {/* RENDER THE EDITOR MODAL IF ACTIVE */}
      {editingDiagram && (
          <DiagramEditor 
              initialSvgContent={editingDiagram.content}
              onSave={handleSaveDiagram}
              onClose={() => setEditingDiagram(null)}
          />
      )}
    </div>
  );
};