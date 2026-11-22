// Ember Duel — a duelist's deck, draw pile, hand and discard pile.
// When the draw pile runs out the discard pile is shuffled back in, so a duel
// never stalls for want of cards.

import { shuffle } from './random.js';
import { buildDeck } from './cards.js';
import { MAX_HAND } from './config.js';

export function createDuelist(random) {
  const deck = shuffle(buildDeck(), random);
  return { drawPile: deck, discardPile: [], hand: [] };
}

/** Draw up to `count` cards into the hand (hand capped at MAX_HAND). Returns how many were drawn. */
export function drawCards(duelist, count, random) {
  let drawn = 0;
  for (let i = 0; i < count; i += 1) {
    if (duelist.hand.length >= MAX_HAND) break;
    if (duelist.drawPile.length === 0) {
      if (duelist.discardPile.length === 0) break;
      duelist.drawPile = shuffle(duelist.discardPile, random);
      duelist.discardPile = [];
    }
    duelist.hand.push(duelist.drawPile.pop());
    drawn += 1;
  }
  return drawn;
}

/** Move a card from the hand to the discard pile. */
export function discardCard(duelist, card) {
  const index = duelist.hand.indexOf(card);
  if (index !== -1) duelist.hand.splice(index, 1);
  duelist.discardPile.push(card);
}
