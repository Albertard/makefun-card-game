// Ember Duel — Cinder, the Ash Warden: the rival's turn, played card by card.
// She reads the table and counters what she sees: piercing blades when you hide
// behind block, healing and walls when her own life runs low, and a killing blow
// whenever she can see one. Returns the cards she played, in order, so the
// renderer can show each one landing.

import { playCard, endRivalTurn } from './engine.js';

const RIVAL_NAME = 'Cinder';

/** How much a card is worth to the rival right now; the best card goes first. */
export function scoreCard(duel, card) {
  const rival = duel.rival;
  const player = duel.player;
  let score = 0;
  for (const effect of card.effects) {
    if (effect.kind === 'damage') {
      // Damage blocked by your wall is worth less; lethal damage is worth everything.
      const through = Math.max(0, effect.value - player.block);
      score += through * 2 + (player.hp - through <= 0 ? 100 : 0);
    } else if (effect.kind === 'pierce') {
      score += effect.value * 2 + (player.hp - effect.value <= 0 ? 100 : 0);
    } else if (effect.kind === 'block') {
      // A wall matters most when you are about to hit her hard.
      score += effect.value * (rival.hp <= 10 ? 1.6 : 0.9);
    } else if (effect.kind === 'heal') {
      const missing = 24 - rival.hp;
      score += Math.min(effect.value, missing) * (rival.hp <= 8 ? 2.2 : 0.8);
    } else if (effect.kind === 'draw') {
      score += 2.5;
    } else if (effect.kind === 'ember') {
      score += 3;
    }
  }
  // Expensive cards should earn their keep.
  return score - card.cost * 0.5;
}

/** Pick the rival's best playable card, or null when she has none. */
export function chooseCard(duel) {
  let best = null;
  let bestScore = 0;
  for (const card of duel.rival.hand) {
    if (card.cost > duel.rival.energy) continue;
    const score = scoreCard(duel, card);
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}

/** Play the rival's whole turn at once (the renderer replays it card by card). */
export function playRivalTurn(duel) {
  const played = [];
  let guard = 0;
  while (duel.phase === 'rival' && guard < 12) {
    guard += 1;
    const card = chooseCard(duel);
    if (!card) break;
    if (!playCard(duel, 'rival', card, RIVAL_NAME)) break;
    played.push(card);
  }
  if (duel.phase === 'rival') endRivalTurn(duel);
  return played;
}
