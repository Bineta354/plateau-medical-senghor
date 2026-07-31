import { useState, useCallback } from 'react';
import { TOOTH_STATES } from './constants';

export const useToothSelector = (initialTeethState = {}, onChange) => {
  const [teeth, setTeeth] = useState(initialTeethState);

  const updateToothData = useCallback((toothId, newData) => {
    setTeeth((prevTeeth) => {
      const newTeeth = {
        ...prevTeeth,
        [toothId]: newData,
      };
      
      if (onChange) {
        onChange(newTeeth);
      }
      return newTeeth;
    });
  }, [onChange]);

  // Helper to get simple state ID safely
  const getToothStateId = (toothId) => {
      const toothData = teeth[toothId];
      if (!toothData) return TOOTH_STATES.HEALTHY.id;
      // Handle both old (string) and new (object) format
      return typeof toothData === 'string' ? toothData : (toothData.state || TOOTH_STATES.HEALTHY.id);
  };

  const handleToothClick = (toothId) => {
      // In the new rich version, click just selects the tooth for the modal
      // We don't toggle state directly on click anymore
      // This function might be deprecated or used just to highlight selection
      // For now, let's keep it compatible but maybe just ensure object structure
      
      const currentData = teeth[toothId] || { state: TOOTH_STATES.HEALTHY.id };
      // Ensure it's an object if we are migrating from string
      const dataObj = typeof currentData === 'string' ? { state: currentData } : currentData;
      
      // We essentially just pass through, the parent will open the modal
      return dataObj;
  };

  const setToothState = (toothId, stateId) => {
     const currentData = teeth[toothId];
     const dataObj = typeof currentData === 'string' ? { state: currentData } : (currentData || {});
     
     updateToothData(toothId, {
         ...dataObj,
         state: stateId
     });
  };

  const getSelectedTeeth = () => {
    return Object.entries(teeth)
      .filter(([_, data]) => {
          const state = typeof data === 'string' ? data : data.state;
          return state === TOOTH_STATES.SELECTED.id;
      })
      .map(([id]) => parseInt(id));
  };

  // FIX: mergeTeethData now merges per-tooth using the freshest "prevTeeth"
  // from the functional setState, instead of relying on a "teeth" value
  // captured earlier by the caller (which could be stale).
  const mergeTeethData = useCallback((teethUpdates) => {
    setTeeth((prevTeeth) => {
      const newTeeth = { ...prevTeeth };
      Object.keys(teethUpdates).forEach((toothId) => {
        const prevData = prevTeeth[toothId] || {};
        const updateData = teethUpdates[toothId] || {};
        newTeeth[toothId] = {
          ...prevData,
          ...updateData,
          history: updateData.history || prevData.history,
        };
      });
      if (onChange) {
        onChange(newTeeth);
      }
      return newTeeth;
    });
  }, [onChange]);

  return {
    teeth,
    handleToothClick,
    setToothState,
    updateToothData, // New function for rich updates
    mergeTeethData, // Merge multiple teeth at once (e.g. loading history)
    getSelectedTeeth,
  };
};