// Ember Duel — shared constants: table size, life totals, energy, suits and timing.
// Every number the rules use lives here so the engine, the AI and the renderer agree.

export const TABLE = { width: 1280, height: 800 };
export const STEP = 1 / 60;

export const START_HP = 24;
export const HAND_SIZE = 5;
export const MAX_HAND = 7;
export const DRAW_PER_TURN = 2;
export const ENERGY_PER_TURN = 3;
export const DECK_SIZE = 20;
export const MAX_TURNS = 40;

// Suits are told apart by colour AND by a drawn shape, never by text alone:
// Flame (damage) is red-orange, Sword (piercing damage) is steel blue,
// Shield (block) is gold, Leaf (heal / draw) is green.
export const SUITS = {
  flame: { name: 'Flame', color: '#ff6b35', dark: '#c33d12', light: '#ffb199' },
  sword: { name: 'Sword', color: '#7fb2ff', dark: '#2f5cb8', light: '#cfe1ff' },
  shield: { name: 'Shield', color: '#f2b705', dark: '#a67c00', light: '#ffe680' },
  leaf: { name: 'Leaf', color: '#4ecb71', dark: '#1f7a37', light: '#a9ecc0' },
};

export const BEST_KEY = 'ember-duel-best-score';
