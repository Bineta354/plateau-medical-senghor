// src/components/dental-chart/toothMap.js

// This file contains the graphical representation of teeth (positions and dimensions).
// The coordinates are set to form a dental arch.
// Dimensions are adjusted for anatomically accurate proportions.

// Convention clinique (odontogramme) : le schéma est dessiné comme si on faisait
// face au patient — le côté droit du patient (quadrants 1 et 4) apparaît donc à
// GAUCHE de l'écran, et son côté gauche (quadrants 2 et 3) à DROITE. C'est
// l'inverse d'une vue anatomique/aérienne, mais c'est la convention universelle
// des schémas dentaires (comme la lecture d'une radio).

export const toothMap = {
  // =====================================================
  // Quadrant 1 (Upper Right, côté droit du patient) - isUpper: true
  // Affiché à GAUCHE de l'écran.
  // =====================================================
  // Third Molar (Wisdom tooth)
  18: { id: 18, type: 'molar', x: -52, y: 85, width: 26, height: 30, rotation: 22, isUpper: true },
  // Second Molar
  17: { id: 17, type: 'molar', x: -22, y: 62, width: 28, height: 32, rotation: 16, isUpper: true },
  // First Molar (largest)
  16: { id: 16, type: 'molar', x: 12, y: 45, width: 30, height: 34, rotation: 10, isUpper: true },
  // Second Premolar
  15: { id: 15, type: 'premolar', x: 46, y: 34, width: 22, height: 28, rotation: 6, isUpper: true },
  // First Premolar
  14: { id: 14, type: 'premolar', x: 74, y: 28, width: 22, height: 28, rotation: 4, isUpper: true },
  // Canine
  13: { id: 13, type: 'canine', x: 102, y: 26, width: 20, height: 32, rotation: 2, isUpper: true },
  // Lateral Incisor (narrower)
  12: { id: 12, type: 'incisor', x: 130, y: 30, width: 16, height: 26, rotation: 0, isUpper: true },
  // Central Incisor (wider)
  11: { id: 11, type: 'incisor', x: 156, y: 34, width: 20, height: 26, rotation: 0, isUpper: true },

  // =====================================================
  // Quadrant 2 (Upper Left, côté gauche du patient) - isUpper: true
  // Affiché à DROITE de l'écran.
  // =====================================================
  // Central Incisor
  21: { id: 21, type: 'incisor', x: 184, y: 34, width: 20, height: 26, rotation: 0, isUpper: true },
  // Lateral Incisor
  22: { id: 22, type: 'incisor', x: 212, y: 30, width: 16, height: 26, rotation: 0, isUpper: true },
  // Canine
  23: { id: 23, type: 'canine', x: 238, y: 26, width: 20, height: 32, rotation: -2, isUpper: true },
  // First Premolar
  24: { id: 24, type: 'premolar', x: 266, y: 28, width: 22, height: 28, rotation: -4, isUpper: true },
  // Second Premolar
  25: { id: 25, type: 'premolar', x: 294, y: 34, width: 22, height: 28, rotation: -6, isUpper: true },
  // First Molar (largest)
  26: { id: 26, type: 'molar', x: 322, y: 45, width: 30, height: 34, rotation: -10, isUpper: true },
  // Second Molar
  27: { id: 27, type: 'molar', x: 355, y: 62, width: 28, height: 32, rotation: -16, isUpper: true },
  // Third Molar (Wisdom tooth)
  28: { id: 28, type: 'molar', x: 385, y: 85, width: 26, height: 30, rotation: -22, isUpper: true },

  // =====================================================
  // Quadrant 4 (Lower Right, côté droit du patient) - isUpper: false
  // Affiché à GAUCHE de l'écran.
  // =====================================================
  // Central Incisor (lower incisors are narrower)
  41: { id: 41, type: 'incisor', x: 156, y: 200, width: 16, height: 24, rotation: 0, isUpper: false },
  // Lateral Incisor
  42: { id: 42, type: 'incisor', x: 132, y: 204, width: 16, height: 24, rotation: 0, isUpper: false },
  // Canine
  43: { id: 43, type: 'canine', x: 104, y: 210, width: 20, height: 30, rotation: -2, isUpper: false },
  // First Premolar
  44: { id: 44, type: 'premolar', x: 76, y: 212, width: 22, height: 26, rotation: -4, isUpper: false },
  // Second Premolar
  45: { id: 45, type: 'premolar', x: 48, y: 208, width: 22, height: 26, rotation: -6, isUpper: false },
  // First Molar (largest)
  46: { id: 46, type: 'molar', x: 14, y: 198, width: 30, height: 32, rotation: -10, isUpper: false },
  // Second Molar
  47: { id: 47, type: 'molar', x: -20, y: 182, width: 28, height: 30, rotation: -16, isUpper: false },
  // Third Molar (Wisdom tooth)
  48: { id: 48, type: 'molar', x: -50, y: 162, width: 26, height: 28, rotation: -22, isUpper: false },

  // =====================================================
  // Quadrant 3 (Lower Left, côté gauche du patient) - isUpper: false
  // Affiché à DROITE de l'écran.
  // =====================================================
  // Central Incisor
  31: { id: 31, type: 'incisor', x: 184, y: 200, width: 16, height: 24, rotation: 0, isUpper: false },
  // Lateral Incisor
  32: { id: 32, type: 'incisor', x: 208, y: 204, width: 16, height: 24, rotation: 0, isUpper: false },
  // Canine
  33: { id: 33, type: 'canine', x: 234, y: 210, width: 20, height: 30, rotation: 2, isUpper: false },
  // First Premolar
  34: { id: 34, type: 'premolar', x: 262, y: 212, width: 22, height: 26, rotation: 4, isUpper: false },
  // Second Premolar
  35: { id: 35, type: 'premolar', x: 290, y: 208, width: 22, height: 26, rotation: 6, isUpper: false },
  // First Molar (largest)
  36: { id: 36, type: 'molar', x: 318, y: 198, width: 30, height: 32, rotation: 10, isUpper: false },
  // Second Molar
  37: { id: 37, type: 'molar', x: 352, y: 182, width: 28, height: 30, rotation: 16, isUpper: false },
  // Third Molar (Wisdom tooth)
  38: { id: 38, type: 'molar', x: 382, y: 162, width: 26, height: 28, rotation: 22, isUpper: false },
};
