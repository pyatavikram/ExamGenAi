import React, { useState, useRef, useEffect } from 'react';
import { 
    X, Check, Minus, Type, Eraser, Square, Circle, Triangle,
    PenTool, RotateCcw, RotateCw, Move, CornerDownLeft, BoxSelect,
    Hexagon // Imported Hexagon for the Polygon tool
} from 'lucide-react';

interface DiagramEditorProps {
    initialSvgContent: string;
    onSave: (newSvgContent: string) => void;
    onClose: () => void;
}

type ToolType = 'select' | 'line' | 'rect' | 'circle' | 'triangle' | 'polygon' | 'angle_maker' | 'pencil' | 'text' | 'eraser' | 'whiteout';

interface DrawingElement {
    id: number;
    type: ToolType;
    points?: {x: number, y: number}[]; 
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    r?: number;
    text?: string;
    angleLabel?: string;
    startAngle?: number;
    endAngle?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
    fill?: string;
    style?: any;
}

// --- MATH HELPERS ---
const distance = (p1: {x:number, y:number}, p2: {x:number, y:number}) => 
    Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const parseTransform = (transformStr: string | null) => {
    if (!transformStr) return { x: 0, y: 0 };
    const match = transformStr.match(/translate\(([^,]+)[,\s]([^)]+)\)/);
    return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 0, y: 0 };
};

const transformPoint = (x: number, y: number, transform: {x:number, y:number}) => {
    return { x: x + transform.x, y: y + transform.y };
};

export const DiagramEditor: React.FC<DiagramEditorProps> = ({ initialSvgContent, onSave, onClose }) => {
    // --- STATE ---
    const [elements, setElements] = useState<DrawingElement[]>([]);
    const [history, setHistory] = useState<DrawingElement[][]>([]);
    const [historyStep, setHistoryStep] = useState(-1);
    const [hasParsedContent, setHasParsedContent] = useState(false);

    const [tool, setTool] = useState<ToolType>('select');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [resizeHandle, setResizeHandle] = useState<string | null>(null);

    // Drawing State
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
    const [currentPoint, setCurrentPoint] = useState<{x: number, y: number} | null>(null);
    const [pencilPath, setPencilPath] = useState<{x: number, y: number}[]>([]);
    const [polyPoints, setPolyPoints] = useState<{x: number, y: number}[]>([]);
    
    // Angle Tool State
    const [angleVertex, setAngleVertex] = useState<{x: number, y: number} | null>(null);
    const [angleStart, setAngleStart] = useState<{x: number, y: number} | null>(null);

    const [snapPos, setSnapPos] = useState<{x: number, y: number} | null>(null);

    // Text Input State
    const [textInputPos, setTextInputPos] = useState<{x: number, y: number} | null>(null);
    const [textInputValue, setTextInputValue] = useState("");
    const [editingTextId, setEditingTextId] = useState<number | null>(null);
    const textInputRef = useRef<HTMLTextAreaElement>(null);

    // Styling
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [strokeDash, setStrokeDash] = useState("none");
    const [fontSize, setFontSize] = useState(24);

    const svgRef = useRef<SVGSVGElement>(null);
    const EDITOR_DIMENSION = 512; 
    const PADDING = 40;
    const viewBoxStr = `0 0 ${EDITOR_DIMENSION} ${EDITOR_DIMENSION}`; 

    // --- NORMALIZATION HELPER ---
    const normalizeAndFit = (els: DrawingElement[]) => {
        if (els.length === 0) return els;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        const check = (x: number, y: number) => {
            if (x < minX) minX = x; if (x > maxX) maxX = x;
            if (y < minY) minY = y; if (y > maxY) maxY = y;
        };

        els.forEach(el => {
            if (el.points) el.points.forEach(p => check(p.x, p.y));
            if (el.type === 'rect') { check(el.x!, el.y!); check(el.x!+el.width!, el.y!+el.height!); }
            if (el.type === 'circle') { check(el.x!-el.r!, el.y!-el.r!); check(el.x!+el.r!, el.y!+el.r!); }
            if (el.type === 'text') { check(el.x!, el.y!); check(el.x! + 20, el.y! + 20); } 
        });

        if (minX === Infinity) return els;

        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const targetSize = EDITOR_DIMENSION - (PADDING * 2);
        
        const scaleX = targetSize / contentW;
        const scaleY = targetSize / contentH;
        const scale = Math.min(scaleX, scaleY, 10); 

        const offsetX = (EDITOR_DIMENSION - (contentW * scale)) / 2 - (minX * scale);
        const offsetY = (EDITOR_DIMENSION - (contentH * scale)) / 2 - (minY * scale);

        return els.map(el => {
            const newEl = { ...el };
            if (newEl.points) newEl.points = newEl.points.map(p => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));
            if (newEl.x !== undefined) newEl.x = newEl.x * scale + offsetX;
            if (newEl.y !== undefined) newEl.y = newEl.y * scale + offsetY;
            if (newEl.width) newEl.width *= scale;
            if (newEl.height) newEl.height *= scale;
            if (newEl.r) newEl.r *= scale;
            
            if (newEl.strokeWidth) newEl.strokeWidth = Math.max(1, newEl.strokeWidth * scale);
            if (newEl.style && newEl.style.fontSize) {
                newEl.style = { ...newEl.style, fontSize: Math.max(12, newEl.style.fontSize * scale) };
            }
            return newEl;
        });
    };

    // --- INITIALIZATION ---
    useEffect(() => {
        if (!initialSvgContent) return;

        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(initialSvgContent, "image/svg+xml");
            
            // 1. Try to load smart state
            const metaState = doc.getElementById('drawing-state');
            if (metaState && metaState.textContent) {
                try {
                    const parsedElements = JSON.parse(metaState.textContent);
                    setElements(parsedElements);
                    setHasParsedContent(true);
                    setHistory([parsedElements]);
                    setHistoryStep(0);
                    return;
                } catch (e) { console.warn("Failed to parse metadata"); }
            }

            // 2. Fallback: Parse raw SVG
            const svgEl = doc.querySelector('svg');
            if (!svgEl) return;

            const newElements: DrawingElement[] = [];
            
            const traverse = (node: Element, parentTransform: {x:number, y:number}) => {
                const nodeTransform = parseTransform(node.getAttribute('transform'));
                const currentTransform = { x: parentTransform.x + nodeTransform.x, y: parentTransform.y + nodeTransform.y };

                Array.from(node.children).forEach(child => {
                    const tag = child.tagName.toLowerCase();
                    if (tag === 'g') traverse(child, currentTransform);
                    else {
                        const tp = (x: any, y: any) => transformPoint(Number(x)||0, Number(y)||0, currentTransform);
                        const stroke = child.getAttribute('stroke') || 'black';
                        const strokeWidth = parseFloat(child.getAttribute('stroke-width') || '1');
                        const fill = child.getAttribute('fill') || 'none';
                        
                        if (tag === 'line') {
                            newElements.push({
                                id: Date.now() + Math.random(), type: 'line',
                                points: [tp(child.getAttribute('x1'), child.getAttribute('y1')), tp(child.getAttribute('x2'), child.getAttribute('y2'))],
                                stroke, strokeWidth
                            });
                        } else if (tag === 'polyline' || tag === 'polygon') {
                            const pointsStr = child.getAttribute('points') || "";
                            const rawPoints = pointsStr.trim().split(/\s+|,/).map(Number).filter(n => !isNaN(n));
                            const points = [];
                            for(let i=0; i<rawPoints.length; i+=2) {
                                points.push(tp(rawPoints[i], rawPoints[i+1]));
                            }
                            if (points.length > 0) {
                                newElements.push({
                                    id: Date.now() + Math.random(), type: tag === 'polygon' ? 'polygon' : 'pencil', 
                                    points, stroke, strokeWidth, fill: 'none'
                                });
                            }
                        } else if (tag === 'rect') {
                            const p = tp(child.getAttribute('x'), child.getAttribute('y'));
                            newElements.push({
                                id: Date.now() + Math.random(), type: 'rect',
                                x: p.x, y: p.y, width: Number(child.getAttribute('width')), height: Number(child.getAttribute('height')),
                                stroke, strokeWidth, fill
                            });
                        } else if (tag === 'circle') {
                            const p = tp(child.getAttribute('cx'), child.getAttribute('cy'));
                            newElements.push({
                                id: Date.now() + Math.random(), type: 'circle',
                                x: p.x, y: p.y, r: Number(child.getAttribute('r')),
                                stroke, strokeWidth, fill
                            });
                        } else if (tag === 'text') {
                            const p = tp(child.getAttribute('x'), child.getAttribute('y'));
                            const fSize = parseFloat(child.getAttribute('font-size') || '16');
                            newElements.push({
                                id: Date.now() + Math.random(), type: 'text',
                                x: p.x, y: p.y, text: child.textContent || "", style: { fontSize: fSize }
                            });
                        }
                    }
                });
            };
            
            traverse(svgEl, {x:0, y:0});
            
            if(newElements.length > 0) {
                const fittedElements = normalizeAndFit(newElements);
                setElements(fittedElements);
                setHasParsedContent(true);
                setHistory([fittedElements]);
                setHistoryStep(0);
            }
        } catch (error) { setHasParsedContent(false); }
    }, [initialSvgContent]);

    // --- HISTORY HELPERS ---
    const pushHistory = (newElements: DrawingElement[]) => {
        const newHistory = history.slice(0, historyStep + 1);
        newHistory.push(newElements);
        setHistory(newHistory);
        setHistoryStep(newHistory.length - 1);
        setElements(newElements);
    };
    const undo = () => { if (historyStep > 0) { setHistoryStep(historyStep - 1); setElements(history[historyStep - 1]); } else if (historyStep === 0) { setHistoryStep(-1); setElements([]); } };
    const redo = () => { if (historyStep < history.length - 1) { setHistoryStep(historyStep + 1); setElements(history[historyStep + 1]); } };

    // --- INTERACTIONS ---
    const getMousePos = (e: React.MouseEvent) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const CTM = svgRef.current.getScreenCTM();
        if (!CTM) return { x: 0, y: 0 };
        return { x: (e.clientX - CTM.e) / CTM.a, y: (e.clientY - CTM.f) / CTM.d };
    };

    const getSnappedPos = (rawPos: {x: number, y: number}) => {
        const SNAP_DISTANCE = 8;
        let bestPoint = null;
        let minDistance = SNAP_DISTANCE;
        const check = (p: {x:number, y:number}) => { const d = distance(rawPos, p); if(d < minDistance) { minDistance = d; bestPoint = p; }};
        
        elements.forEach(el => {
            if (el.points) el.points.forEach(check);
            if (el.type === 'rect') { check({x:el.x!, y:el.y!}); check({x:el.x!+el.width!, y:el.y!}); check({x:el.x!, y:el.y!+el.height!}); check({x:el.x!+el.width!, y:el.y!+el.height!}); }
        });
        return bestPoint;
    };

    const confirmText = () => {
        if (!textInputPos) return;
        const val = textInputValue.trim();
        if (editingTextId !== null) {
            const updated = val === "" ? elements.filter(el => el.id !== editingTextId) 
                : elements.map(el => el.id === editingTextId ? { ...el, text: val } : el); 
            pushHistory(updated);
            setEditingTextId(null);
        } else if (val !== "") {
            pushHistory([...elements, { id: Date.now(), type: 'text', x: textInputPos.x, y: textInputPos.y, text: val, style: { fontSize } }]);
        }
        setTextInputPos(null); setTextInputValue("");
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const rawPos = getMousePos(e);
        const pos = snapPos || rawPos;

        if (textInputPos) { confirmText(); return; }
        if (tool === 'text') { setTextInputPos(pos); setTimeout(() => textInputRef.current?.focus(), 10); return; }

        // --- POLYGON TOOL START (Step 1: Add Point) ---
        if (tool === 'polygon') {
            setPolyPoints([...polyPoints, pos]);
            return;
        }

        // --- ANGLE TOOL START ---
        if (tool === 'angle_maker') {
            if (!angleVertex) setAngleVertex(pos);
            else if (!angleStart) setAngleStart(pos);
            else {
                const startRad = Math.atan2(angleStart.y - angleVertex.y, angleStart.x - angleVertex.x);
                const endRad = Math.atan2(pos.y - angleVertex.y, pos.x - angleVertex.x);
                let diff = endRad - startRad;
                while(diff <= -Math.PI) diff += 2*Math.PI; while(diff > Math.PI) diff -= 2*Math.PI;
                const deg = Math.abs(Math.round(diff * (180/Math.PI)));
                const label = prompt(`Angle (~${deg}°):`, deg.toString());
                const finalLabel = label ? (label.includes('°') ? label : `${label}°`) : "";
                if (label !== null) pushHistory([...elements, { id: Date.now(), type: 'angle_maker', x: angleVertex.x, y: angleVertex.y, startAngle: startRad, endAngle: endRad, angleLabel: finalLabel, strokeWidth }]);
                setAngleVertex(null); setAngleStart(null);
            }
            return;
        }

        if (tool === 'select') {
            if (selectedId !== null) {
                const el = elements.find(e => e.id === selectedId);
                if(el && (el.type === 'rect' || el.type === 'whiteout')) {
                    if (distance(rawPos, {x: el.x!+el.width!, y:el.y!+el.height!}) < 20) {
                        setResizeHandle('br'); setIsDrawing(true); return;
                    }
                }
            }

            const idx = [...elements].reverse().findIndex(el => {
                if(el.type === 'text') return Math.abs(el.x! - rawPos.x) < 40 && Math.abs(el.y! - rawPos.y) < 20;
                if(el.type === 'rect' || el.type === 'whiteout') return rawPos.x >= el.x! && rawPos.x <= el.x!+el.width! && rawPos.y >= el.y! && rawPos.y <= el.y!+el.height!;
                if(el.points) return el.points.some(p => distance(p, rawPos) < 15);
                return false;
            });
            if (idx !== -1) {
                const el = elements[elements.length - 1 - idx];
                setSelectedId(el.id); setIsDrawing(true); setStartPoint(rawPos); setResizeHandle('move');
            } else { setSelectedId(null); }
            return;
        }

        setIsDrawing(true); setStartPoint(pos); setCurrentPoint(pos);
        if (tool === 'pencil' || tool === 'eraser') setPencilPath([pos]);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const rawPos = getMousePos(e);
        setSnapPos(getSnappedPos(rawPos));
        const pos = snapPos || rawPos;
        setCurrentPoint(pos);

        if (isDrawing) {
            if (tool === 'select' && selectedId !== null) {
                const el = elements.find(e => e.id === selectedId);
                if (resizeHandle === 'move' && startPoint) {
                    const dx = pos.x - startPoint.x; const dy = pos.y - startPoint.y;
                    setElements(elements.map(e => {
                        if (e.id !== selectedId) return e;
                        if (e.points) return { ...e, points: e.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
                        return { ...e, x: (e.x||0) + dx, y: (e.y||0) + dy };
                    }));
                    setStartPoint(pos);
                } 
                else if (resizeHandle === 'br' && el && (el.type === 'rect' || el.type === 'whiteout')) {
                    setElements(elements.map(e => {
                        if (e.id !== selectedId) return e;
                        return {...e, width: Math.max(10, pos.x - e.x!), height: Math.max(10, pos.y - e.y!)};
                    }));
                }
            } else if (tool === 'pencil' || tool === 'eraser') {
                setPencilPath([...pencilPath, pos]);
            }
        }
    };

    const handleMouseUp = () => {
        if (tool === 'select') { if(isDrawing) pushHistory(elements); setIsDrawing(false); setResizeHandle(null); return; }
        if (tool === 'angle_maker' || tool === 'text') return;
        
        // --- POLYGON TOOL (Prevent premature save) ---
        if (tool === 'polygon') return;

        if (!isDrawing || !startPoint || !currentPoint) return;
        setIsDrawing(false);

        const newEl: DrawingElement = { 
            id: Date.now(), type: tool, 
            stroke: tool === 'eraser' || tool === 'whiteout' ? 'white' : 'black', 
            strokeWidth, strokeDasharray: strokeDash, 
            fill: tool === 'whiteout' ? 'white' : 'none' 
        };
        
        if (tool === 'line') newEl.points = [startPoint, currentPoint];
        else if (tool === 'rect' || tool === 'whiteout') {
            newEl.x = Math.min(startPoint.x, currentPoint.x); newEl.y = Math.min(startPoint.y, currentPoint.y);
            newEl.width = Math.abs(currentPoint.x - startPoint.x); newEl.height = Math.abs(currentPoint.y - startPoint.y);
            if (tool === 'whiteout') newEl.stroke = 'none'; 
        } else if (tool === 'triangle') {
            newEl.points = [{x: (startPoint.x+currentPoint.x)/2, y: Math.min(startPoint.y, currentPoint.y)}, {x: Math.max(startPoint.x, currentPoint.x), y: Math.max(startPoint.y, currentPoint.y)}, {x: Math.min(startPoint.x, currentPoint.x), y: Math.max(startPoint.y, currentPoint.y)}];
        } else if (tool === 'circle') {
            newEl.x = startPoint.x; newEl.y = startPoint.y; newEl.r = distance(startPoint, currentPoint);
        } else if (tool === 'pencil' || tool === 'eraser') {
            newEl.points = pencilPath; if(tool==='eraser') newEl.strokeWidth = 20;
        }
        
        pushHistory([...elements, newEl]);
        setStartPoint(null); setPencilPath([]);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        // --- POLYGON TOOL FINISH ---
        if (tool === 'polygon' && polyPoints.length > 2) {
             const newEl: DrawingElement = { 
                id: Date.now(), type: 'polygon', points: polyPoints, 
                stroke: 'black', strokeWidth, strokeDasharray: strokeDash, fill: 'none' 
            };
            pushHistory([...elements, newEl]);
            setPolyPoints([]);
            return;
        }

        if(tool === 'select' && selectedId) {
            const el = elements.find(e => e.id === selectedId);
            if(el?.type === 'text') { setEditingTextId(el.id); setTextInputPos({x: el.x!, y: el.y!}); setTextInputValue(el.text||""); }
        }
    };

    // --- RENDER HELPERS ---
    const renderPreview = () => {
        if (tool === 'angle_maker') {
            if(angleVertex && !angleStart && currentPoint) return <line x1={angleVertex.x} y1={angleVertex.y} x2={currentPoint.x} y2={currentPoint.y} stroke="red" strokeDasharray="4" />;
            if(angleVertex && angleStart && currentPoint) return <><line x1={angleVertex.x} y1={angleVertex.y} x2={angleStart.x} y2={angleStart.y} stroke="gray" strokeDasharray="4"/><line x1={angleVertex.x} y1={angleVertex.y} x2={currentPoint.x} y2={currentPoint.y} stroke="red" strokeDasharray="4"/></>;
            return null;
        }

        // Polygon Rubber-band preview
        if (tool === 'polygon' && polyPoints.length > 0) {
            const lastPoint = polyPoints[polyPoints.length - 1];
            return (
                <>
                    <polyline points={polyPoints.map(p=>`${p.x},${p.y}`).join(' ')} stroke="blue" fill="none" strokeWidth={2} strokeDasharray="4" />
                    {currentPoint && <line x1={lastPoint.x} y1={lastPoint.y} x2={currentPoint.x} y2={currentPoint.y} stroke="blue" strokeDasharray="4" />}
                </>
            );
        }

        if ((tool === 'pencil' || tool === 'eraser') && pencilPath.length > 0) {
            return <polyline points={pencilPath.map(p=>`${p.x},${p.y}`).join(' ')} stroke={tool==='eraser'?'pink':'blue'} fill="none" strokeWidth={tool==='eraser'?20:2} opacity={0.5}/>;
        }

        if (!isDrawing || !startPoint || !currentPoint) return null;
        
        const comm = { stroke: "blue", fill: tool === 'whiteout' ? 'white' : 'none', opacity: 0.5, strokeDasharray: '4' };
        if (tool === 'line') return <line x1={startPoint.x} y1={startPoint.y} x2={currentPoint.x} y2={currentPoint.y} stroke="blue" strokeDasharray="4"/>;
        if (tool === 'rect' || tool === 'whiteout') return <rect x={Math.min(startPoint.x,currentPoint.x)} y={Math.min(startPoint.y,currentPoint.y)} width={Math.abs(startPoint.x-currentPoint.x)} height={Math.abs(startPoint.y-currentPoint.y)} {...comm}/>;
        if (tool === 'circle') return <circle cx={startPoint.x} cy={startPoint.y} r={distance(startPoint, currentPoint)} {...comm}/>;
        if (tool === 'triangle') {
             const minX = Math.min(startPoint.x, currentPoint.x), maxX = Math.max(startPoint.x, currentPoint.x);
             const minY = Math.min(startPoint.y, currentPoint.y), maxY = Math.max(startPoint.y, currentPoint.y);
             const mx = minX + (maxX-minX)/2;
             return <polygon points={`${mx},${minY} ${maxX},${maxY} ${minX},${maxY}`} {...comm} />;
        }
        return null;
    };

    // --- SAVE LOGIC ---
    const handleSave = () => {
        if (svgRef.current) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            const update = (x: number, y: number) => {
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            };

            elements.forEach(el => {
                if (el.points) el.points.forEach(p => update(p.x, p.y));
                if (el.type === 'rect' || el.type === 'whiteout') { update(el.x!, el.y!); update(el.x!+el.width!, el.y!+el.height!); }
                if (el.type === 'circle') { update(el.x!-el.r!, el.y!-el.r!); update(el.x!+el.r!, el.y!+el.r!); }
                if (el.type === 'text') {
                    const fSize = el.style?.fontSize || 24;
                    const w = (el.text?.length || 0) * fSize * 0.6;
                    update(el.x!, el.y! - fSize); 
                    update(el.x! + w, el.y! + fSize * 0.2); 
                }
                if (el.type === 'angle_maker') update(el.x!, el.y!); 
            });

            if (minX === Infinity) { minX = 0; minY = 0; maxX = 100; maxY = 100; }

            const pad = 10;
            const width = (maxX - minX) + pad*2;
            const height = (maxY - minY) + pad*2;
            const vb = `${minX - pad} ${minY - pad} ${width} ${height}`;

            const stateData = JSON.stringify(elements);
            const content = svgRef.current.innerHTML;
            onSave(`<svg viewBox="${vb}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="overflow:visible"><desc id="drawing-state">${stateData}</desc>${content}</svg>`);
        }
        onClose();
    };

    // --- RENDER ---
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-3xl flex flex-col h-[90vh]">
                <div className="flex-none flex flex-wrap gap-2 border-b pb-2 mb-2 justify-between bg-gray-50 p-2 rounded-t">
                    <div className="flex gap-1 flex-wrap">
                        <ToolBtn active={tool==='select'} onClick={() => setTool('select')} icon={<Move size={16}/>} title="Select/Move/Resize"/>
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <ToolBtn active={tool==='text'} onClick={() => setTool('text')} icon={<Type size={16}/>} />
                        <ToolBtn active={tool==='angle_maker'} onClick={() => { setTool('angle_maker'); setAngleVertex(null); setAngleStart(null); }} icon={<CornerDownLeft size={16}/>} title="3-Click Angle" />
                        <ToolBtn active={tool==='line'} onClick={() => setTool('line')} icon={<Minus className="-rotate-45" size={16}/>} />
                        <ToolBtn active={tool==='rect'} onClick={() => setTool('rect')} icon={<Square size={16}/>} />
                        <ToolBtn active={tool==='circle'} onClick={() => setTool('circle')} icon={<Circle size={16}/>} />
                        <ToolBtn active={tool==='triangle'} onClick={() => setTool('triangle')} icon={<Triangle size={16}/>} />
                        <ToolBtn active={tool==='polygon'} onClick={() => { setTool('polygon'); setPolyPoints([]); }} icon={<Hexagon size={16}/>} title="Polygon (Click points, Double-click to finish)" />
                        <div className="w-px h-6 bg-gray-300 mx-1"></div>
                        <ToolBtn active={tool==='pencil'} onClick={() => setTool('pencil')} icon={<PenTool size={16}/>} />
                        <ToolBtn active={tool==='eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={16}/>} title="Fine Eraser" />
                        <ToolBtn active={tool==='whiteout'} onClick={() => setTool('whiteout')} icon={<BoxSelect size={16}/>} title="Box Eraser (Whiteout)" />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={undo} className="p-2 bg-white rounded hover:bg-gray-100 border"><RotateCcw size={16}/></button>
                        <button onClick={redo} className="p-2 bg-white rounded hover:bg-gray-100 border"><RotateCw size={16}/></button>
                        <button onClick={handleSave} className="bg-green-600 text-white px-3 py-1 rounded flex items-center gap-1 hover:bg-green-700 font-medium"><Check size={16}/> Save</button>
                        <button onClick={onClose} className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300 font-medium"><X size={16}/></button>
                    </div>
                </div>

                <div className="flex-1 bg-gray-100 overflow-auto flex justify-center items-center relative cursor-crosshair">
                    <div 
                        className="bg-white shadow-lg relative"
                        style={{ width: `${EDITOR_DIMENSION}px`, height: `${EDITOR_DIMENSION}px` }}
                        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onDoubleClick={handleDoubleClick}
                    >
                        {!hasParsedContent && <div className="absolute inset-0 opacity-50 pointer-events-none flex items-center justify-center text-gray-400">Loading Diagram...</div>}
                        <svg ref={svgRef} viewBox={viewBoxStr} className="absolute inset-0 w-full h-full pointer-events-none">
                            {elements.map(el => {
                                if (el.id === editingTextId) return null;
                                const style = { opacity: el.id === selectedId ? 0.6 : 1 };
                                if(el.type === 'text') return <text key={el.id} x={el.x} y={el.y} fontSize={el.style?.fontSize || 24} fontFamily="Times New Roman" fill="black" style={style}>{el.text}</text>;
                                if(el.type === 'line') return <line key={el.id} x1={el.points![0].x} y1={el.points![0].y} x2={el.points![1].x} y2={el.points![1].y} stroke={el.stroke} strokeWidth={el.strokeWidth} strokeDasharray={el.strokeDasharray} style={style}/>;
                                if(el.type === 'rect' || el.type === 'whiteout') return <rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} style={style}/>;
                                if(el.type === 'circle') return <circle key={el.id} cx={el.x} cy={el.y} r={el.r} stroke={el.stroke} fill={el.fill} strokeWidth={el.strokeWidth} style={style}/>;
                                
                                // FIX: Use <polygon> for triangle and polygon to ensure closure
                                if(el.type === 'triangle' || el.type === 'polygon') return <polygon key={el.id} points={el.points!.map(p=>`${p.x},${p.y}`).join(' ')} stroke={el.stroke} fill="none" strokeWidth={el.strokeWidth} style={style}/>;
                                // Keep <polyline> for open paths (pencil, eraser)
                                if(el.type === 'pencil' || el.type === 'eraser') return <polyline key={el.id} points={el.points!.map(p=>`${p.x},${p.y}`).join(' ')} stroke={el.stroke} fill="none" strokeWidth={el.strokeWidth} style={style}/>;
                                
                                if(el.type === 'angle_maker') {
                                    const r = 30; const x1 = el.x!+r*Math.cos(el.startAngle!), y1 = el.y!+r*Math.sin(el.startAngle!);
                                    const x2 = el.x!+r*Math.cos(el.endAngle!), y2 = el.y!+r*Math.sin(el.endAngle!);
                                    const large = Math.abs(el.endAngle!-el.startAngle!) > Math.PI ? 1 : 0;
                                    return <g key={el.id} style={style}><path d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`} fill="none" stroke="black"/><text x={el.x!+35} y={el.y!-10} fontSize="16">{el.angleLabel}</text></g>;
                                }
                                return null;
                            })}
                            
                            {renderPreview()}

                            {snapPos && <circle cx={snapPos.x} cy={snapPos.y} r={5} stroke="magenta" fill="none"/>}
                        </svg>
                        {textInputPos && <textarea ref={textInputRef} value={textInputValue} onChange={e=>setTextInputValue(e.target.value)} className="absolute bg-white border border-blue-500 z-50 p-1" style={{left:textInputPos.x, top:textInputPos.y, fontSize:`${fontSize}px`, fontFamily:'Times New Roman', minWidth:'100px'}} autoFocus/>}
                    </div>
                </div>
                <div className="p-2 border-t text-xs flex gap-4">
                    <span>Width: <button onClick={()=>setStrokeWidth(2)} className={strokeWidth===2?'font-bold':''}>Thin</button> | <button onClick={()=>setStrokeWidth(4)} className={strokeWidth===4?'font-bold':''}>Thick</button></span>
                    <span>Style: <button onClick={()=>setStrokeDash('none')} className={strokeDash==='none'?'font-bold':''}>Solid</button> | <button onClick={()=>setStrokeDash('5,5')} className={strokeDash!=='none'?'font-bold':''}>Dashed</button></span>
                    <span>Text Size: <button onClick={()=>setFontSize(16)} className={fontSize===16?'font-bold':''}>S</button> | <button onClick={()=>setFontSize(24)} className={fontSize===24?'font-bold':''}>M</button> | <button onClick={()=>setFontSize(32)} className={fontSize===32?'font-bold':''}>L</button></span>
                </div>
            </div>
        </div>
    );
};

const ToolBtn = ({active, onClick, icon, title}: any) => <button onClick={onClick} title={title} className={`p-2 rounded ${active?'bg-blue-600 text-white':'bg-white hover:bg-gray-100'}`}>{icon}</button>;