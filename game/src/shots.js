// Ember Duel — the screenshot scenes behind ?shot=start|play|end|loss, and the
// autopilot that plays a real duel for them. Each scene plays the real rules
// forward from a fresh duel with the seeded deck, so the frame is what a short
// game really looks like and the same seed always gives the same frame.

import { startDuel, playCard, endPlayerTurn, finalScore } from './engine.js';
import { playRivalTurn } from './ai.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WON, SCREEN_LOST } from './render.js';

const PLAY_ROUNDS = 2;
const MAX_ROUNDS = 30;

/** How much a card is worth to the player right now; the best card goes first. */
export function scorePlayerCard(duel, card) {
  const player = duel.player;
  const rival = duel.rival;
  let score = 0;
  for (const effect of card.effects) {
    if (effect.kind === 'damage') {
      const through = Math.max(0, effect.value - rival.block);
      score += through * 2 + (rival.hp - through <= 0 ? 100 : 0);
    } else if (effect.kind === 'pierce') {
      score += effect.value * 2 + (rival.hp - effect.value <= 0 ? 100 : 0);
    } else if (effect.kind === 'block') {
      score += effect.value * (player.hp <= 10 ? 1.5 : 0.9);
    } else if (effect.kind === 'heal') {
      score += Math.min(effect.value, 24 - player.hp) * (player.hp <= 8 ? 2.2 : 0.8);
    } else if (effect.kind === 'draw') {
      score += 2.5;
    } else if (effect.kind === 'ember') {
      score += 3;
    }
  }
  return score - card.cost * 0.5;
}

/** The player's best playable card right now, or null when nothing is worth playing. */
export function choosePlayerCard(duel) {
  let best = null;
  let bestScore = 0;
  for (const card of duel.player.hand) {
    if (card.cost > duel.player.energy) continue;
    const score = scorePlayerCard(duel, card);
    if (score > bestScore) {
      bestScore = score;
      best = card;
    }
  }
  return best;
}

/** One full player turn from the autopilot: play good cards, then end the turn. */
export function autopilotPlayerTurn(duel) {
  let guard = 0;
  while (duel.phase === 'player' && guard < 12) {
    guard += 1;
    const card = choosePlayerCard(duel);
    if (!card) break;
    if (!playCard(duel, 'player', card, 'You')) break;
  }
  if (duel.phase === 'player') endPlayerTurn(duel);
}

/** One full round (player turn, then the rival's) from the autopilot. */
export function autopilotRound(duel) {
  if (duel.phase === 'player') autopilotPlayerTurn(duel);
  if (duel.phase === 'rival') playRivalTurn(duel);
}

/**
 * Set `duel` to the named scene (start, play, end, loss; any other name is start)
 * and return the screen to draw over it, plus the score to show.
 */
export function stageShot(name, duel) {
  startDuel(duel);
  if (name !== 'play' && name !== 'end' && name !== 'loss') {
    return { screen: SCREEN_TITLE, best: 0, score: 0 };
  }
  if (name === 'loss') {
    // A careless player: never play a card, just end the turn. Cinder wins.
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      if (duel.phase === 'player') endPlayerTurn(duel);
      if (duel.phase === 'rival') playRivalTurn(duel);
      if (duel.phase === 'lost') break;
    }
    if (duel.lastPlay) duel.lastPlay.shownAt = 0;
    return { screen: duel.phase === 'lost' ? SCREEN_LOST : SCREEN_PLAY, best: 0, score: 0 };
  }
  if (name === 'play') {
    for (let round = 0; round < PLAY_ROUNDS; round += 1) {
      autopilotRound(duel);
      if (duel.phase === 'won' || duel.phase === 'lost') break;
    }
    if (duel.lastPlay) duel.lastPlay.shownAt = 0;
    return { screen: SCREEN_PLAY, best: 0, score: 0 };
  }
  // end: the autopilot plays to a win.
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    autopilotRound(duel);
    if (duel.phase === 'won' || duel.phase === 'lost') break;
  }
  if (duel.lastPlay) duel.lastPlay.shownAt = 0;
  return {
    screen: duel.phase === 'won' ? SCREEN_WON : SCREEN_PLAY,
    best: 0,
    score: finalScore(duel),
  };
}
