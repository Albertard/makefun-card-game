// Ember Duel — the card catalogue. Every card is original: a name, a suit, a cost
// in embers, and an effect. Effects are small verbs the engine applies:
//   damage N  — deal N to the other duelist (reduced by their block)
//   pierce N  — deal N, ignoring block
//   block N   — gain N block until your next turn
//   heal N    — restore N life (never above the starting total)
//   draw N    — draw N cards
//   ember N   — gain N energy this turn
// A card may carry two effects; the second is the combo that makes a hand a decision.

export const CARD_DEFS = {
  'ember-spark': {
    name: 'Ember Spark', suit: 'flame', cost: 1,
    text: 'Deal 3 damage.', effects: [{ kind: 'damage', value: 3 }],
  },
  'wildfire': {
    name: 'Wildfire', suit: 'flame', cost: 2,
    text: 'Deal 6 damage.', effects: [{ kind: 'damage', value: 6 }],
  },
  'inferno': {
    name: 'Inferno', suit: 'flame', cost: 3,
    text: 'Deal 10 damage.', effects: [{ kind: 'damage', value: 10 }],
  },
  'kindle': {
    name: 'Kindle', suit: 'flame', cost: 1,
    text: 'Deal 2 damage. Gain 1 ember.', effects: [{ kind: 'damage', value: 2 }, { kind: 'ember', value: 1 }],
  },
  'quick-slash': {
    name: 'Quick Slash', suit: 'sword', cost: 1,
    text: 'Deal 4 piercing damage.', effects: [{ kind: 'pierce', value: 4 }],
  },
  'twin-blades': {
    name: 'Twin Blades', suit: 'sword', cost: 2,
    text: 'Deal 5 piercing damage. Draw 1.', effects: [{ kind: 'pierce', value: 5 }, { kind: 'draw', value: 1 }],
  },
  'skyfall-blade': {
    name: 'Skyfall Blade', suit: 'sword', cost: 3,
    text: 'Deal 8 piercing damage.', effects: [{ kind: 'pierce', value: 8 }],
  },
  'stonewall': {
    name: 'Stonewall', suit: 'shield', cost: 1,
    text: 'Gain 5 block.', effects: [{ kind: 'block', value: 5 }],
  },
  'bulwark': {
    name: 'Bulwark', suit: 'shield', cost: 2,
    text: 'Gain 9 block.', effects: [{ kind: 'block', value: 9 }],
  },
  'aegis': {
    name: 'Aegis', suit: 'shield', cost: 3,
    text: 'Gain 13 block.', effects: [{ kind: 'block', value: 13 }],
  },
  'iron-vow': {
    name: 'Iron Vow', suit: 'shield', cost: 1,
    text: 'Gain 3 block. Draw 1.', effects: [{ kind: 'block', value: 3 }, { kind: 'draw', value: 1 }],
  },
  'sprout': {
    name: 'Sprout', suit: 'leaf', cost: 1,
    text: 'Heal 3. Draw 1.', effects: [{ kind: 'heal', value: 3 }, { kind: 'draw', value: 1 }],
  },
  'bloom': {
    name: 'Bloom', suit: 'leaf', cost: 2,
    text: 'Heal 6.', effects: [{ kind: 'heal', value: 6 }],
  },
  'thorn-vine': {
    name: 'Thorn Vine', suit: 'leaf', cost: 2,
    text: 'Deal 3 damage. Heal 3.', effects: [{ kind: 'damage', value: 3 }, { kind: 'heal', value: 3 }],
  },
  'ember-pact': {
    name: 'Ember Pact', suit: 'flame', cost: 2,
    text: 'Deal 5 damage. Draw 1.', effects: [{ kind: 'damage', value: 5 }, { kind: 'draw', value: 1 }],
  },
};

// The deck list: how many copies of each card a duelist shuffles in. Twenty cards.
export const DECK_LIST = [
  ['ember-spark', 3], ['wildfire', 2], ['inferno', 1], ['kindle', 2],
  ['quick-slash', 2], ['twin-blades', 1], ['skyfall-blade', 1],
  ['stonewall', 2], ['bulwark', 1], ['aegis', 1], ['iron-vow', 1],
  ['sprout', 1], ['bloom', 1], ['thorn-vine', 1],
];

/** A fresh card instance: a stable id plus its definition. */
export function makeCard(defId, uid) {
  const def = CARD_DEFS[defId];
  return { uid, defId, name: def.name, suit: def.suit, cost: def.cost, text: def.text, effects: def.effects };
}

/** The full 20-card deck, unshuffled, as card instances. */
export function buildDeck() {
  const cards = [];
  let uid = 0;
  for (const [defId, count] of DECK_LIST) {
    for (let i = 0; i < count; i += 1) cards.push(makeCard(defId, uid += 1));
  }
  return cards;
}
