import React, { useRef, useEffect, useState } from 'react';
import { toothMap } from './toothMap';
import { TOOTH_STATES, TOOTH_NAMES } from './constants';
import { drawTooth, drawToothNumber } from './drawingUtils';
import { formatMontant } from '../../utils/currency';

const MouthCanvas = ({ teeth, onToothClick, readOnly = false, toothStates }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Utiliser les états passés en props ou fallback sur les constantes
  const effectiveStates = toothStates || TOOTH_STATES;

  // Pre-calculate bounding box of teeth once
  const bounds = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 });
  useEffect(() => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      Object.values(toothMap).forEach(t => {
          minX = Math.min(minX, t.x);
          maxX = Math.max(maxX, t.x + t.width);
          minY = Math.min(minY, t.y);
          maxY = Math.max(maxY, t.y + t.height);
      });
      bounds.current = { 
          minX, maxX, minY, maxY, 
          width: maxX - minX, 
          height: maxY - minY 
      };
  }, []);

  // Store transform parametrs
  const transform = useRef({ offsetX: 0, offsetY: 0, scale: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    
    const handleResize = () => {
        if (!containerRef.current || !canvas) return;
        
        const parentWidth = containerRef.current.clientWidth;
        const parentHeight = containerRef.current.clientHeight || parentWidth;

        canvas.width = parentWidth * window.devicePixelRatio;
        canvas.height = parentHeight * window.devicePixelRatio;
        
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        
        // Calculate scaling to fit content
        const contentW = bounds.current.width;
        const contentH = bounds.current.height;
        const canvasW = canvas.width;
        const canvasH = canvas.height;
        
        // Add some padding (e.g. 10%)
        const padding = Math.min(canvasW, canvasH) * 0.1;
        const availableW = canvasW - padding * 2;
        const availableH = canvasH - padding * 2;
        
        const scale = Math.min(availableW / contentW, availableH / contentH);
        
        // Center the content
        // content drawn at (x,y)
        // transformed x = x * scale + offsetX
        // center of content in logical coords: minX + contentW/2
        // center of canvas: canvasW / 2
        // (minX + contentW/2) * scale + offsetX = canvasW / 2
        // offsetX = canvasW/2 - (minX + contentW/2)*scale
        
        const offsetX = (canvasW / 2) - (bounds.current.minX + contentW / 2) * scale;
        const offsetY = (canvasH / 2) - (bounds.current.minY + contentH / 2) * scale;
        
        transform.current = { offsetX, offsetY, scale };
        
        redrawCanvas();
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial sizing

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [teeth, hoveredTooth, toothStates]); 

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas; // current canvas physical size
    const { offsetX, offsetY, scale } = transform.current;

    ctx.clearRect(0, 0, width, height);

    Object.values(toothMap).forEach((tooth) => {
      // Get state
      const toothData = teeth[tooth.id];
      const stateId = typeof toothData === 'string' ? toothData : (toothData?.state || TOOTH_STATES.HEALTHY.id);
      
      // Lookup state in dynamic map (by code/id) or values list
      let state = effectiveStates[stateId]; 
      if (!state) {
         // Fallback lookups
         state = Object.values(effectiveStates).find(s => s.id === stateId || s.code === stateId);
      }
      state = state || TOOTH_STATES.HEALTHY;

      // Hover effect
      let renderState = state;
      // TOOTH_STATES.HEALTHY.id might be 'HEALTHY' while dynamic state id is 1, so compare codes if possible
      // Assuming TOOTH_STATES.HEALTHY is the baseline.
      const isHealthy = state.code === 'HEALTHY' || state.id === 'HEALTHY' || (!state.code && state.id === TOOTH_STATES.HEALTHY.id);
      
      if (hoveredTooth === tooth.id) {
          if (isHealthy) {
             renderState = { ...state, color: '#f0f9ff', borderColor: '#2563eb' }; 
          } else {
             renderState = { ...state, borderColor: '#000', borderWidth: 2 };
          }
      }

      ctx.save();
      // Apply transform
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      drawTooth(ctx, tooth, renderState);
      drawToothNumber(ctx, tooth); // This renders relative to tooth x,y so it works
      
      ctx.restore();
    });
  };

  const getLogicaPos = (evt) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Mouse relative to canvas CSS box
    const clientX = (evt.clientX - rect.left);
    const clientY = (evt.clientY - rect.top);
    
    // Mouse relative to actual canvas pixels
    const x = clientX * (canvas.width / rect.width);
    const y = clientY * (canvas.height / rect.height);
    
    // Inverse transform to get logical tooth space coordinates
    const { offsetX, offsetY, scale } = transform.current;
    
    const logicalX = (x - offsetX) / scale;
    const logicalY = (y - offsetY) / scale;
    
    return { x: logicalX, y: logicalY };
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { x, y } = getLogicaPos(e);
    
    let found = null;
    
    const teethList = Object.values(toothMap);
    // Reverse for Z-order if needed, though they don't overlap much
    for (const tooth of teethList) {
        // Distance check in logical coords
        const dx = x - (tooth.x + tooth.width/2); // center of tooth roughly
        const dy = y - (tooth.y + tooth.height/2);
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        // Use tooth dimension for radius approximation
        const radius = Math.max(tooth.width, tooth.height) / 2;
        
        if (dist < radius + 2) { // tolerant hit test
             found = tooth.id;
             break;
        }
    }

    if (found !== hoveredTooth) {
        setHoveredTooth(found);
        canvas.style.cursor = found ? 'pointer' : 'default';
    }

    if (found) {
        setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  };
  
  const handleMouseLeave = () => {
    setHoveredTooth(null);
  };

  const handleClick = (e) => {
      if (readOnly) return;
      if (hoveredTooth) {
          onToothClick(hoveredTooth);
      }
  };

  return (
    <div ref={containerRef} className="w-full h-full flex justify-center items-center relative">
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="touch-none"
      />
      {hoveredTooth && (
        <div 
            className="fixed pointer-events-none bg-gray-900 text-white text-xs rounded py-2 px-3 z-50 shadow-lg transform -translate-x-1/2 -translate-y-full mt-[-10px] max-w-xs"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
            <div className="font-bold mb-1">Dent {hoveredTooth}</div>
            <div className="text-gray-300 mb-2">{TOOTH_NAMES[hoveredTooth]}</div>
            {/* Afficher l'historique des actes si disponible */}
            {teeth[hoveredTooth]?.history && teeth[hoveredTooth].history.length > 0 && (
                <div className="border-t border-gray-700 pt-2 mt-2">
                    <div className="text-xs font-semibold text-gray-400 mb-1">Actes récents :</div>
                    {teeth[hoveredTooth].history.slice(0, 3).map((item, idx) => (
                        <div key={idx} className="text-xs text-gray-300 py-0.5">
                            <span className="text-blue-400">•</span> {item.name}
                            {item.price && <span className="text-gray-500 ml-1">({formatMontant(item.price)})</span>}
                        </div>
                    ))}
                    {teeth[hoveredTooth].history.length > 3 && (
                        <div className="text-xs text-gray-500 italic">
                            +{teeth[hoveredTooth].history.length - 3} autre(s) acte(s)
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default MouthCanvas;
