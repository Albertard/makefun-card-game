// Ember Duel — boot and the one loop: input is read every frame, the renderer
// paints what is there, and the duel moves between title, play, paused, won and
// lost screens.
//
// ?seed=N fixes the decks. ?shot=start|play|end|loss (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot. ?autoplay=1 plays a real duel on its own, card by card.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createDuel, startDuel, playCard, endPlayerTurn, endRivalTurn, finalScore,
  PHASE_PLAYER, PHASE_RIVAL, PHASE_WON, PHASE_LOST,
} from './engine.js';
import { chooseCard } from './ai.js';
import { ACTION_CONFIRM, ACTION_END_TURN, ACTION_PAUSE, createInput } from './input.js';
import {
  createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_WON, SCREEN_LOST,
} from './render.js';
import { stageShot, choosePlayerCard } from './shots.js';
import { playSound } from './sound.js';

const MAX_FRAME = 0.25;
const AUTOPLAY_STEP_SECONDS = 0.7;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const autoplay = params.get('autoplay') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const duel = createDuel(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, duel);
  const best = scene.score > 0 ? Math.max(readBest(), scene.score) : readBest();
  let painted = 0;
  function paint() {
    renderer.draw(duel, scene.screen, best, { time: 0.5, snap: true, score: scene.score });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let started = false;
  let elapsed = 0;
  let last = performance.now();
  let autoplayTimer = 0;
  let lastRects = { handRects: [], endTurnRect: null };

  function announce(message) {
    status.textContent = message;
  }

  function notePlay() {
    if (duel.lastPlay) duel.lastPlay.shownAt = elapsed;
  }

  function beginDuel() {
    startDuel(duel);
    started = true;
    screen = SCREEN_PLAY;
    announce('Playing. Spend embers, play cards, end your turn with E.');
  }

  function finishDuel() {
    if (duel.phase === PHASE_WON) {
      screen = SCREEN_WON;
      const score = finalScore(duel);
      if (score > best) {
        best = score;
        saveBest(best);
      }
      playSound('win');
      announce(`Victory! Score ${score}. Best ${best}.`);
    } else if (duel.phase === PHASE_LOST) {
      screen = SCREEN_LOST;
      playSound('lose');
      announce('Defeat. Cinder takes the duel.');
    }
  }

  function playAsPlayer(card) {
    if (!card || duel.phase !== PHASE_PLAYER) return;
    const suit = card.suit;
    if (playCard(duel, 'player', card, 'You')) {
      notePlay();
      playSound(suit === 'shield' ? 'block' : suit === 'leaf' ? 'heal' : 'hit');
      if (duel.phase === PHASE_WON || duel.phase === PHASE_LOST) finishDuel();
    }
  }

  function endTurn() {
    if (duel.phase !== PHASE_PLAYER) return;
    if (endPlayerTurn(duel)) playSound('turn');
  }

  function rivalStep() {
    if (duel.phase !== PHASE_RIVAL) return;
    const card = chooseCard(duel);
    if (card) {
      const suit = card.suit;
      if (playCard(duel, 'rival', card, 'Cinder')) {
        notePlay();
        playSound(suit === 'shield' ? 'block' : suit === 'leaf' ? 'heal' : 'hit');
      }
      if (duel.phase === PHASE_WON || duel.phase === PHASE_LOST) finishDuel();
    } else {
      endRivalTurn(duel);
    }
  }

  function autoplayStep() {
    if (screen !== SCREEN_PLAY) return;
    if (duel.phase === PHASE_PLAYER) {
      const card = choosePlayerCard(duel);
      if (card) playAsPlayer(card);
      else endTurn();
    } else if (duel.phase === PHASE_RIVAL) {
      rivalStep();
    }
  }

  function handleInput() {
    const actions = input.takeActions();
    const numberKey = input.takeNumberKey();
    const click = input.takeClick();
    const mouse = input.mousePosition();

    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM || click) beginDuel();
      return;
    }
    if (screen === SCREEN_WON || screen === SCREEN_LOST) {
      if (actions & ACTION_CONFIRM || click) beginDuel();
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen !== SCREEN_PLAY) return;

    if (numberKey >= 1 && numberKey <= duel.player.hand.length) {
      playAsPlayer(duel.player.hand[numberKey - 1]);
      return;
    }
    if (click) {
      const rects = lastRects.handRects;
      for (let i = rects.length - 1; i >= 0; i -= 1) {
        const r = rects[i];
        if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) {
          const card = duel.player.hand.find((c) => c.uid === r.uid);
          playAsPlayer(card);
          return;
        }
      }
      const end = lastRects.endTurnRect;
      if (end && click.x >= end.x && click.x <= end.x + end.w && click.y >= end.y && click.y <= end.y + end.h) {
        endTurn();
        return;
      }
    }
    if (actions & ACTION_END_TURN) endTurn();
  }

  function hoverUid() {
    const mouse = input.mousePosition();
    const rects = lastRects.handRects;
    for (let i = rects.length - 1; i >= 0; i -= 1) {
      const r = rects[i];
      if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) return r.uid;
    }
    return null;
  }

  function endTurnHovered() {
    const mouse = input.mousePosition();
    const end = lastRects.endTurnRect;
    return !!(end && mouse.x >= end.x && mouse.x <= end.x + end.w && mouse.y >= end.y && mouse.y <= end.y + end.h);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    elapsed += dt;
    if (autoplay && screen === SCREEN_TITLE) beginDuel();
    handleInput();
    if (autoplay) {
      autoplayTimer += dt;
      if (autoplayTimer >= AUTOPLAY_STEP_SECONDS) {
        autoplayTimer = 0;
        autoplayStep();
      }
    } else if (screen === SCREEN_PLAY && duel.phase === PHASE_RIVAL) {
      // The rival plays one card a beat apart so each one lands visibly.
      autoplayTimer += dt;
      if (autoplayTimer >= 0.6) {
        autoplayTimer = 0;
        rivalStep();
      }
    } else {
      autoplayTimer = 0;
    }
    if (!started && screen === SCREEN_TITLE) {
      // A dealt table waits behind the title, so the first frame already shows cards.
      startDuel(duel);
      started = true;
    }
    lastRects = renderer.draw(duel, screen, best, {
      time: elapsed,
      hoverUid: hoverUid(),
      endTurnHovered: endTurnHovered(),
      score: duel.phase === PHASE_WON ? finalScore(duel) : 0,
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Ember Duel. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
