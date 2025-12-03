import React, { useState } from 'react';
import { ExamPaperData, Question, ContentPart, GridConfig, SchoolConfig } from '../types';
import { RefreshCw, Image as ImageIcon, GripVertical, RotateCcw, MousePointerClick } from 'lucide-react';


interface PaperRendererProps {
  config: SchoolConfig;
  data: ExamPaperData | null;
  onUpdateData: (newData: ExamPaperData) => void;
}

interface ImageState {
    isDrawn: boolean;
    seed: number;
}

export const PaperRenderer: React.FC<PaperRendererProps> = ({ config, data, onUpdateData }) => {
  const [imageStates, setImageStates] = useState<Record<string, ImageState>>({});
  const [draggedItem, setDraggedItem] = useState<{ sIdx: number; qIdx: number } | null>(null);

  if (!data || !data.sections) return null;

  // --- IMAGE HELPERS ---
  const getImageState = (key: string) => imageStates[key] || { isDrawn: false, seed: Math.floor(Math.random() * 1000) };

  const handleDraw = (key: string) => {
      setImageStates(prev => ({ ...prev, [key]: { isDrawn: true, seed: prev[key]?.seed || Math.floor(Math.random() * 1000) } }));
  };

  const handleRedraw = (key: string) => {
      setImageStates(prev => ({ ...prev, [key]: { isDrawn: true, seed: Math.floor(Math.random() * 10000) } }));
  };

  const getPollinationsUrl = (prompt: string, seed: number) => {
    const safePrompt = encodeURIComponent(`${prompt}, simple vector line art, coloring book style, black and white, white background, no shading, educational illustration`);
    return `https://image.pollinations.ai/prompt/${safePrompt}?width=512&height=512&nologo=true&seed=${seed}&model=flux`;
  };

  // --- DRAG & DROP ---
  const handleDragStart = (sIdx: number, qIdx: number) => setDraggedItem({ sIdx, qIdx });
  const handleDragEnd = () => setDraggedItem(null);
  
  const handleDragEnter = (targetSIdx: number, targetQIdx: number) => {
      if (!draggedItem || draggedItem.sIdx !== targetSIdx || draggedItem.qIdx === targetQIdx) return;
      const newData = { ...data };
      const section = newData.sections[targetSIdx];
      if (!section.questions) return;
      const item = section.questions.splice(draggedItem.qIdx, 1)[0];
      section.questions.splice(targetQIdx, 0, item);
      setDraggedItem({ sIdx: targetSIdx, qIdx: targetQIdx });
      onUpdateData(newData);
  };

  // --- NEW: RENDER REFERENCE DIAGRAMS ---
  const renderReference = (ref: { type: 'image' | 'svg', value: string }, uniqueKey: string) => {
    // SVG (Code)
    if (ref.type === 'svg') {
        return (
            <div 
                className="my-2 flex justify-center w-full max-w-md mx-auto border border-gray-100 p-2 rounded"
                dangerouslySetInnerHTML={{ __html: ref.value }} 
            />
        );
    }
    // IMAGE (Pollinations with Draw Button) - Reusing your exact image logic
    const state = getImageState(uniqueKey);
    return (
        <div className="flex flex-col items-center my-2 mx-4 group">
             {state.isDrawn ? (
                <>
                    <img 
                        src={getPollinationsUrl(ref.value, state.seed)}
                        alt="Reference"
                        className="h-48 w-auto border border-gray-200 shadow-sm rounded bg-white mb-1 object-contain"
                    />
                    <button onClick={() => handleRedraw(uniqueKey)} className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1 transition-colors no-print">
                        <RotateCcw className="w-3 h-3" /> Redraw
                    </button>
                </>
            ) : (
                <div className="flex flex-col items-center">
                    <div className="w-48 h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 bg-gray-50 mb-1 px-2 text-center">
                        <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-[10px] leading-tight line-clamp-3">{ref.value}</span>
                    </div>
                    <button onClick={() => handleDraw(uniqueKey)} className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded flex items-center gap-1 transition-colors no-print font-medium">
                        <MousePointerClick className="w-3 h-3" /> Draw Diagram
                    </button>
                </div>
            )}
        </div>
    );
  };

  // --- RENDER CONTENT PART ---
  const renderContentPart = (part: ContentPart, uniqueKey: string) => {
    if (!part) return null;

    // Placeholder for the content element
    let contentElement: React.ReactNode = null;

    // 1. TEXT (Your exact existing logic + OR handling)
    if (part.type === 'text') {
        const text = part.value || '';
        if (text.trim()) {
             // Check for (OR)
             if (/^\(?\s*OR\s*\)?$/i.test(text.trim())) {
                contentElement = (
                    <div className="w-full text-center font-bold text-gray-500 my-3 text-sm tracking-widest border-t border-b border-gray-100 py-1">
                        — {text} —
                    </div>
                );
             } else {
                contentElement = <span className="mr-1 align-baseline text-lg leading-loose">{text}</span>;
             }
        }
    }
    
    // 2. IMAGE (Your exact existing logic with Draw Button preserved)
    else if (part.type === 'image') {
        const state = getImageState(uniqueKey);
        contentElement = (
            <div className="inline-flex flex-col items-center m-2 align-middle group">
                {state.isDrawn ? (
                    <>
                        <img src={getPollinationsUrl(part.value, state.seed)} alt={part.value} className="h-24 w-24 border border-gray-100 rounded object-contain bg-white mb-1" />
                        <button onClick={() => handleRedraw(uniqueKey)} className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded flex items-center gap-1 transition-colors no-print">
                            <RotateCcw className="w-3 h-3" /> Redraw
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col items-center">
                        <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 bg-gray-50 mb-1">
                            <ImageIcon className="w-6 h-6 mb-1 opacity-50" />
                            <span className="text-[9px] text-center px-1 leading-tight line-clamp-2">{part.value}</span>
                        </div>
                        <button onClick={() => handleDraw(uniqueKey)} className="text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded flex items-center gap-1 transition-colors no-print font-medium">
                            <MousePointerClick className="w-3 h-3" /> Draw
                        </button>
                    </div>
                )}
            </div>
        );
    }
    
    // 3. TABLE (New)
    else if (part.type === 'table' && part.table_data) {
        contentElement = (
            <div className="my-4 overflow-x-auto w-full">
                <table className="min-w-full border-collapse border border-black text-sm">
                    <thead>
                        <tr>
                            {part.table_data.headers.map((h, i) => (
                                <th key={i} className="border border-black px-3 py-1 bg-gray-50 text-center font-bold">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {part.table_data.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                                {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="border border-black px-3 py-1 text-center">
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }
    
    // 4. SVG (New)
    else if (part.type === 'svg') {
        contentElement = <span className="inline-block align-middle my-2" dangerouslySetInnerHTML={{ __html: part.value }} />;
    }

    // --- CHECK FOR REFERENCE (New Wrapper Logic) ---
    // If there is a reference diagram attached, we wrap the content
    if (part.reference) {
        return (
            <div className="w-full flex flex-col items-start">
                <div className="w-full flex justify-center mb-2">
                    {renderReference(part.reference, `${uniqueKey}-ref`)}
                </div>
                <div className="w-full">
                    {contentElement}
                </div>
            </div>
        );
    }

    return contentElement;
  };

  const renderGrid = (config: GridConfig) => (
    <div className="mt-2 border-l border-t border-black inline-block">
        {Array.from({ length: config.rows }).map((_, r) => (
            <div key={r} className="flex">
                {Array.from({ length: config.cols }).map((_, c) => (
                    <div key={c} className="w-10 h-8 border-r border-b border-black"></div>
                ))}
            </div>
        ))}
    </div>
  );

  const renderMCQ = (options: ContentPart[], baseKey: string) => (
    <div className="flex flex-wrap gap-8 mt-2 justify-start items-start">
        {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 border-2 border-gray-400 rounded-full cursor-pointer hover:bg-gray-100 flex-shrink-0"></div>
                <div>{renderContentPart(opt, `${baseKey}-opt-${i}`)}</div>
            </div>
        ))}
    </div>
  );

  const renderAnswerLines = (count: number) => (
    <div className="w-full mt-2 mb-2">
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-end h-8 mb-1 w-full">
                {i === 0 && <span className="font-bold mr-2 text-base text-gray-800 shrink-0 mb-1">Ans:</span>}
                {i > 0 && <span className="w-10 shrink-0"></span>} 
                <div className="flex-1 border-b-2 border-black border-dotted"></div>
            </div>
        ))}
    </div>
  );

  // --- NEW: VERTICAL MATH RENDERER ---
  const renderVerticalMath = (config: any) => {
    if (!config) return null;

    if (config.subtype === 'division') {
        return (
            <div className="inline-flex items-center font-mono text-2xl tracking-widest mx-4 my-4">
                <span className="mr-1 font-bold">{config.divisor}</span>
                <span className="text-3xl font-light leading-none transform scale-y-110">)</span>
                <span className="border-t-2 border-black px-3 ml-1 font-bold">{config.dividend}</span>
            </div>
        );
    }

    if (config.subtype === 'stack' && config.values) {
        const { values, operator } = config;
        const maxLength = Math.max(...values.map((v: string) => v.length));
        const headers = maxLength === 3 ? ['H','T','O'] : maxLength === 4 ? ['Th','H','T','O'] : [];

        return (
            <div className="inline-block px-6 py-2 align-top">
                {headers.length > 0 && (
                    <div className="flex justify-end gap-4 mb-1 text-gray-400 font-bold text-xs">
                        {headers.map((h: string, i: number) => <div key={i} className="w-4 text-center">{h}</div>)}
                    </div>
                )}
                <div className="flex flex-col items-end">
                    {values.map((val: string, i: number) => (
                        <div key={i} className="flex items-center gap-4 relative">
                            {i === values.length - 1 && <span className="absolute -left-8 font-bold text-xl">{operator}</span>}
                            <div className="flex gap-4 justify-end font-mono text-xl tracking-widest font-semibold">
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

  // --- MATCH FOLLOWING (Symmetric Layout) ---
  const renderMatchFollowing = (questions: Question[], sIdx: number) => {
    return (
        <div className="mt-4 px-2">
            {questions.map((q, qIdx) => {
                const rightText = q.match_pair?.right?.type === 'text' ? q.match_pair.right.value.trim() : "";
                const hasLabel = /^[a-zA-Z0-9]+[.)]/.test(rightText); 
                return (
                    <div 
                        key={qIdx}
                        className={`
                            flex items-center justify-between py-3 border-b border-gray-100 last:border-0
                            ${draggedItem?.sIdx === sIdx && draggedItem?.qIdx === qIdx ? 'bg-gray-100 opacity-50' : 'hover:bg-gray-50'}
                            group relative
                        `}
                        draggable
                        onDragStart={() => handleDragStart(sIdx, qIdx)}
                        onDragEnter={() => handleDragEnter(sIdx, qIdx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                    >
                        <div className="absolute -left-4 top-1/2 -translate-y-1/2 text-gray-400 opacity-0 group-hover:opacity-100 cursor-move no-print"><GripVertical className="w-4 h-4" /></div>
                        
                        {/* LEFT SIDE - 45% */}
                        <div className="w-[45%] flex items-center justify-start gap-3 pr-2">
                            <span className="font-bold min-w-[20px]">{q.question_number}.</span>
                            <div className="flex-1">{q.match_pair?.left && renderContentPart(q.match_pair.left, `s${sIdx}-q${qIdx}-left`)}</div>
                        </div>

                        {/* CENTER - 10% */}
                        <div className="w-[10%] flex justify-center items-center">
                            {hasLabel && <span className="font-bold font-mono text-xl text-gray-800 whitespace-nowrap">( &nbsp;&nbsp; )</span>}
                        </div>

                        {/* RIGHT SIDE - 45% */}
                        <div className="w-[45%] flex items-center justify-start gap-3 pl-4">
                            <div className="flex-1">{q.match_pair?.right && renderContentPart(q.match_pair.right, `s${sIdx}-q${qIdx}-right`)}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  return (
    <div id="exam-paper-content" className="print-container w-full max-w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none min-h-[297mm] p-[15mm] text-black font-serif leading-normal relative">
      
      {/* HEADER */}
      <div className="border-b-2 border-black pb-4 mb-6">
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

      {/* SECTIONS */}
      <div className="exam-content space-y-6">
        {data.sections?.map((section, sIdx) => (
          <div key={sIdx} className="break-inside-avoid">
            <div className="flex justify-between items-baseline mb-3">
               <h3 className="font-bold text-lg uppercase tracking-wide">{section.heading}</h3>
               <span className="font-bold text-sm whitespace-nowrap">{section.marks}</span>
            </div>

            {section.section_type === 'match_following' ? (
                section.questions && renderMatchFollowing(section.questions, sIdx)
            ) : (
                <div className="space-y-4">
                  {section.questions?.map((q, qIdx) => (
                    <div 
                        key={qIdx}
                        className={`relative group p-1 rounded transition-colors ${draggedItem?.sIdx === sIdx && draggedItem?.qIdx === qIdx ? 'bg-gray-100 opacity-50' : 'hover:bg-gray-50'}`}
                        draggable
                        onDragStart={() => handleDragStart(sIdx, qIdx)}
                        onDragEnter={() => handleDragEnter(sIdx, qIdx)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                    >
                      <div className="absolute -left-4 top-1 text-gray-400 opacity-0 group-hover:opacity-100 cursor-move no-print">
                        <GripVertical className="w-4 h-4" />
                      </div>

                      <div className="flex gap-2">
                          <div className="font-bold min-w-[24px] pt-1">{q.question_number}.</div>
                          
                          <div className="flex-1">
                            {/* CONTENT (Text, Tables, Inline Images, References) */}
                            <div className="mb-1 leading-relaxed">
                                {(q.content_parts || []).map((part, pIdx) => (
                                    <React.Fragment key={pIdx}>
                                        {renderContentPart(part, `s${sIdx}-q${qIdx}-p${pIdx}`)}
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* ANSWERS */}
                            {q.answer_type === 'grid' && q.grid_config && renderGrid(q.grid_config)}
                            {q.answer_type === 'mcq' && q.options && renderMCQ(q.options, `s${sIdx}-q${qIdx}`)}
                            {q.answer_type === 'vertical_math' && q.vertical_math_config && renderVerticalMath(q.vertical_math_config)}
                          </div>
                      </div>

                      {(q.answer_lines || 0) > 0 && renderAnswerLines(q.answer_lines!)}
                    </div>
                  ))}
                </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="w-full text-center text-[10px] text-gray-400 mt-12 pb-4 print:text-black">
        Generated by ExamGen AI
      </div>
    </div>
  );
};