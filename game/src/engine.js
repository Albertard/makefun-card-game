// Ember Duel — the duel itself: turns, energy, playing cards, block, win and loss.
// The engine is pure state plus small functions, so the same code runs in the
// browser, in the autopilot and in the Node logic tests.
//
// A duel: each side has life, block (gone at the start of its next turn), energy
// (refilled each turn), a hand and a deck. On your turn you play cards, then press
// End Turn; the rival then plays its own turn. The first side to 0 life loses.
// Score on a win: life left x100, plus 25 for every turn under 20.

import {
  START_HP, HAND_SIZE, DRAW_PER_TURN, ENERGY_PER_TURN, MAX_TURNS,
} from './config.js';
import { createDuelist, drawCards, discardCard } from './deck.js';

export const PHASE_TITLE = 'title';
export const PHASE_PLAYER = 'player';
export const PHASE_RIVAL = 'rival';
export const PHASE_WON = 'won';
export const PHASE_LOST = 'lost';

export function createDuel(random) {
  const duel = {
    random,
    turn: 1,
    phase: PHASE_TITLE,
    player: { hp: START_HP, block: 0, energy: 0, ...createDuelist(random) },
    rival: { hp: START_HP, block: 0, energy: 0, ...createDuelist(random) },
    log: [],
    lastPlay: null,
    winner: null,
  };
  return duel;
}

function sideLog(duel, message) {
  duel.log.unshift(message);
  if (duel.log.length > 5) duel.log.length = 5;
}

/** Start a fresh duel: deal opening hands and open the player's first turn. */
export function startDuel(duel) {
  duel.turn = 1;
  duel.phase = PHASE_PLAYER;
  duel.winner = null;
  duel.lastPlay = null;
  duel.log = [];
  drawCards(duel.player, HAND_SIZE, duel.random);
  drawCards(duel.rival, HAND_SIZE, duel.random);
  duel.player.energy = ENERGY_PER_TURN;
  sideLog(duel, 'The duel begins. Your move, Ember.');
}

function dealDamage(duel, target, amount, piercing) {
  let left = amount;
  if (!piercing && target.block > 0) {
    const absorbed = Math.min(target.block, left);
    target.block -= absorbed;
    left -= absorbed;
  }
  target.hp = Math.max(0, target.hp - left);
  return left;
}

/** Apply one card's effects. `actor` plays it, `target` receives the damage. */
export function applyCard(duel, actor, target, card) {
  for (const effect of card.effects) {
    if (effect.kind === 'damage') dealDamage(duel, target, effect.value, false);
    else if (effect.kind === 'pierce') dealDamage(duel, target, effect.value, true);
    else if (effect.kind === 'block') actor.block += effect.value;
    else if (effect.kind === 'heal') actor.hp = Math.min(START_HP, actor.hp + effect.value);
    else if (effect.kind === 'draw') drawCards(actor, effect.value, duel.random);
    else if (effect.kind === 'ember') actor.energy += effect.value;
  }
}

function checkEnd(duel) {
  if (duel.player.hp <= 0) {
    duel.phase = PHASE_LOST;
    duel.winner = 'rival';
  } else if (duel.rival.hp <= 0) {
    duel.phase = PHASE_WON;
    duel.winner = 'player';
  }
  return duel.phase === PHASE_WON || duel.phase === PHASE_LOST;
}

/** Can this side play this card right now? */
export function canPlay(duel, side, card) {
  const actor = side === 'player' ? duel.player : duel.rival;
  return duel.phase === (side === 'player' ? PHASE_PLAYER : PHASE_RIVAL)
    && actor.energy >= card.cost
    && actor.hand.includes(card);
}

/**
 * Play a card from a side's hand. Returns true when it was played.
 * `label` is the side's display name, for the log.
 */
export function playCard(duel, side, card, label) {
  if (!canPlay(duel, side, card)) return false;
  const actor = side === 'player' ? duel.player : duel.rival;
  const target = side === 'player' ? duel.rival : duel.player;
  actor.energy -= card.cost;
  discardCard(actor, card);
  applyCard(duel, actor, target, card);
  duel.lastPlay = { side, card, at: Date.now() };
  sideLog(duel, `${label} played ${card.name}.`);
  checkEnd(duel);
  return true;
}

/** End the player's turn: the rival takes over with fresh energy and a draw. */
export function endPlayerTurn(duel) {
  if (duel.phase !== PHASE_PLAYER) return false;
  duel.phase = PHASE_RIVAL;
  duel.rival.block = 0;
  duel.rival.energy = ENERGY_PER_TURN;
  drawCards(duel.rival, DRAW_PER_TURN, duel.random);
  sideLog(duel, 'Cinder takes her turn…');
  return true;
}

/** End the rival's turn: a new round begins for the player. */
export function endRivalTurn(duel) {
  if (duel.phase !== PHASE_RIVAL) return false;
  duel.turn += 1;
  duel.phase = PHASE_PLAYER;
  duel.player.block = 0;
  duel.player.energy = ENERGY_PER_TURN;
  drawCards(duel.player, DRAW_PER_TURN, duel.random);
  sideLog(duel, `Turn ${duel.turn}. Your move, Ember.`);
  if (duel.turn > MAX_TURNS) {
    // A duel that runs too long is decided by life: the healthier duelist wins.
    duel.phase = duel.player.hp >= duel.rival.hp ? PHASE_WON : PHASE_LOST;
    duel.winner = duel.player.hp >= duel.rival.hp ? 'player' : 'rival';
    sideLog(duel, 'The embers fade — the healthier duelist wins.');
  }
  return true;
}

/** The win score: life left is worth the most, fast wins earn a bonus. */
export function finalScore(duel) {
  if (duel.phase !== PHASE_WON) return 0;
  return duel.player.hp * 100 + Math.max(0, 20 - duel.turn) * 25;
}
