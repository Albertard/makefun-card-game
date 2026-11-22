// Ember Duel — the renderer: one 2D canvas paints the whole table.
// The table is a warm dark felt with drifting embers; the rival's hand sits at the
// top as face-down card backs, yours at the bottom face-up, and the last card
// played lands in the middle with a flip. Cards slide toward their slots every
// frame, so a dealt hand has weight and a played card snaps into place.
// Suits are drawn shapes (flame, sword, shield, leaf) in their own colours.

import { TABLE, SUITS, START_HP, ENERGY_PER_TURN } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WON = 'won';
export const SCREEN_LOST = 'lost';

const CARD_W = 150;
const CARD_H = 208;
const BACK_W = 92;
const BACK_H = 128;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}

/** Draw a suit's icon at (cx, cy) with the given size and colour. */
export function drawSuitIcon(ctx, suit, cx, cy, size, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.08);
  ctx.lineJoin = 'round';
  const s = size / 2;
  if (suit === 'flame') {
    // A flame: a teardrop with a flicked tip.
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.bezierCurveTo(cx + s * 0.9, cy - s * 0.2, cx + s * 0.7, cy + s * 0.7, cx, cy + s);
    ctx.bezierCurveTo(cx - s * 0.7, cy + s * 0.7, cx - s * 0.9, cy - s * 0.2, cx, cy - s);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.2);
    ctx.bezierCurveTo(cx + s * 0.45, cy + s * 0.15, cx + s * 0.3, cy + s * 0.65, cx, cy + s * 0.7);
    ctx.bezierCurveTo(cx - s * 0.3, cy + s * 0.65, cx - s * 0.45, cy + s * 0.15, cx, cy - s * 0.2);
    ctx.fill();
  } else if (suit === 'sword') {
    // A sword: blade up, guard across, hilt below.
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.28, cy - s * 0.25);
    ctx.lineTo(cx + s * 0.18, cy + s * 0.35);
    ctx.lineTo(cx - s * 0.18, cy + s * 0.35);
    ctx.lineTo(cx - s * 0.28, cy - s * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - s * 0.55, cy + s * 0.35, s * 1.1, s * 0.16);
    ctx.fillRect(cx - s * 0.1, cy + s * 0.5, s * 0.2, s * 0.5);
  } else if (suit === 'shield') {
    // A shield: flat top, curved sides, point at the bottom.
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.8, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.8, cy - s * 0.7);
    ctx.lineTo(cx + s * 0.8, cy + s * 0.1);
    ctx.quadraticCurveTo(cx + s * 0.8, cy + s * 0.7, cx, cy + s);
    ctx.quadraticCurveTo(cx - s * 0.8, cy + s * 0.7, cx - s * 0.8, cy + s * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.45);
    ctx.lineTo(cx + s * 0.35, cy - s * 0.1);
    ctx.lineTo(cx, cy + s * 0.55);
    ctx.lineTo(cx - s * 0.35, cy - s * 0.1);
    ctx.closePath();
    ctx.fill();
  } else {
    // A leaf: two arcs meeting at a stem.
    ctx.beginPath();
    ctx.moveTo(cx, cy - s);
    ctx.quadraticCurveTo(cx + s, cy - s * 0.3, cx + s * 0.55, cy + s * 0.6);
    ctx.quadraticCurveTo(cx, cy + s, cx - s * 0.55, cy + s * 0.6);
    ctx.quadraticCurveTo(cx - s, cy - s * 0.3, cx, cy - s);
    ctx.fill();
    ctx.strokeStyle = '#d8ffe2';
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.8);
    ctx.lineTo(cx, cy + s * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/** The big number on a card: its main effect value (damage / block / heal). */
function cardPower(card) {
  const main = card.effects[0];
  return main && (main.kind === 'damage' || main.kind === 'pierce' || main.kind === 'block' || main.kind === 'heal')
    ? main.value
    : null;
}

function drawCardFace(ctx, card, x, y, w, h, opts) {
  const suit = SUITS[card.suit];
  const playable = opts.playable;
  const hovered = opts.hovered;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  if (opts.tilt) ctx.rotate(opts.tilt);
  ctx.translate(-w / 2, -h / 2);
  if (hovered) {
    ctx.shadowColor = suit.color;
    ctx.shadowBlur = 22;
  }
  roundRect(ctx, 0, 0, w, h, 12);
  ctx.fillStyle = '#fdf6e3';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = playable ? 4 : 2;
  ctx.strokeStyle = playable ? suit.color : '#8a6d3b';
  ctx.stroke();
  // Suit band across the top.
  ctx.save();
  roundRect(ctx, 0, 0, w, 34, 12);
  ctx.fillStyle = suit.color;
  ctx.fill();
  ctx.fillRect(0, 20, w, 14);
  ctx.restore();
  // Cost gem, top left.
  ctx.beginPath();
  ctx.arc(20, 20, 15, 0, Math.PI * 2);
  ctx.fillStyle = '#2b1d12';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffd23e';
  ctx.stroke();
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 17px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(card.cost), 20, 21);
  // Suit name on the band.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(suit.name.toUpperCase(), 42, 21);
  // Big suit icon.
  drawSuitIcon(ctx, card.suit, w / 2, 78, 56, suit.color);
  // Power number under the icon.
  const power = cardPower(card);
  if (power !== null) {
    ctx.fillStyle = '#2b1d12';
    ctx.font = 'bold 34px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(power), w / 2, 138);
  }
  // Card name.
  ctx.fillStyle = '#2b1d12';
  ctx.font = 'bold 15px Georgia, serif';
  ctx.fillText(card.name, w / 2, 164);
  // Effect text.
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = '#5a4632';
  ctx.textAlign = 'center';
  wrapText(ctx, card.text, w / 2, 184, w - 18, 14);
  ctx.restore();
}

function drawCardBack(ctx, x, y, w, h) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = '#3a1f4d';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#f2b705';
  ctx.stroke();
  roundRect(ctx, x + 6, y + 6, w - 12, h - 12, 7);
  ctx.strokeStyle = 'rgba(242,183,5,0.5)';
  ctx.stroke();
  drawSuitIcon(ctx, 'flame', x + w / 2, y + h / 2, 44, '#ff6b35');
  ctx.restore();
}

function drawHpBar(ctx, x, y, w, hp, maxHp, block, label) {
  ctx.save();
  ctx.font = 'bold 15px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, x, y - 14);
  roundRect(ctx, x, y, w, 20, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fill();
  const frac = Math.max(0, hp / maxHp);
  if (frac > 0) {
    roundRect(ctx, x, y, w * frac, 20, 10);
    ctx.fillStyle = frac > 0.5 ? '#4ecb71' : frac > 0.25 ? '#f2b705' : '#ff5340';
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${hp} / ${maxHp}`, x + w / 2, y + 11);
  if (block > 0) {
    ctx.fillStyle = '#7fb2ff';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.textAlign = 'left';
    drawSuitIcon(ctx, 'shield', x + w + 14, y + 10, 18, '#7fb2ff');
    ctx.fillText(String(block), x + w + 30, y + 11);
  }
  ctx.restore();
}

function drawEmbers(ctx, x, y, energy, maxEnergy) {
  ctx.save();
  ctx.font = 'bold 14px Georgia, serif';
  ctx.fillStyle = '#ffb199';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Embers', x, y);
  for (let i = 0; i < maxEnergy; i += 1) {
    const cx = x + 70 + i * 26;
    ctx.beginPath();
    ctx.arc(cx, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = i < energy ? '#ff6b35' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = i < energy ? '#ffd23e' : 'rgba(255,255,255,0.3)';
    ctx.stroke();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const positions = new Map();
  let embers = [];
  let emberSeed = 0;

  function seedEmbers() {
    embers = [];
    let s = 12345;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 40; i += 1) {
      embers.push({ x: rnd() * TABLE.width, y: rnd() * TABLE.height, r: 1 + rnd() * 2.5, speed: 8 + rnd() * 22, drift: rnd() * 10 });
    }
    emberSeed = s;
  }
  seedEmbers();

  function drawBackground(time) {
    const grad = ctx.createRadialGradient(640, 380, 80, 640, 400, 900);
    grad.addColorStop(0, '#4a2c14');
    grad.addColorStop(0.55, '#2b1a10');
    grad.addColorStop(1, '#160d08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TABLE.width, TABLE.height);
    // Felt ellipse.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(640, 400, 560, 330, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(46, 90, 52, 0.28)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(242, 183, 5, 0.35)';
    ctx.stroke();
    ctx.restore();
    // Drifting embers.
    ctx.save();
    for (const e of embers) {
      const y = ((e.y - time * e.speed) % TABLE.height + TABLE.height) % TABLE.height;
      const x = e.x + Math.sin(time * 0.5 + e.r * 5) * e.drift;
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(time * 2 + e.r * 9);
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath();
      ctx.arc(x, y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function handSlot(index, count) {
    const gap = 12;
    const total = count * CARD_W + (count - 1) * gap;
    const startX = (TABLE.width - total) / 2;
    return { x: startX + index * (CARD_W + gap), y: 560, tilt: (index - (count - 1) / 2) * 0.03 };
  }

  function drawRivalHand(duel) {
    const count = duel.rival.hand.length;
    const total = count * (BACK_W + 6) - 6;
    const startX = (TABLE.width - total) / 2;
    for (let i = 0; i < count; i += 1) {
      drawCardBack(ctx, startX + i * (BACK_W + 6), 96, BACK_W, BACK_H);
    }
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Cinder holds ${count} card${count === 1 ? '' : 's'}`, TABLE.width - 24, 160);
    ctx.restore();
  }

  function drawPlayerHand(duel, hoverUid, snap) {
    const hand = duel.player.hand;
    const rects = [];
    hand.forEach((card, index) => {
      const slot = handSlot(index, hand.length);
      const hovered = card.uid === hoverUid;
      const target = { x: slot.x, y: hovered ? slot.y - 26 : slot.y, tilt: slot.tilt };
      let pos = positions.get(card.uid);
      if (!pos) {
        pos = { x: 640 - CARD_W / 2, y: 820, tilt: 0 };
        positions.set(card.uid, pos);
      }
      if (snap) {
        pos.x = target.x;
        pos.y = target.y;
        pos.tilt = target.tilt;
      } else {
        pos.x += (target.x - pos.x) * 0.16;
        pos.y += (target.y - pos.y) * 0.16;
        pos.tilt += (target.tilt - pos.tilt) * 0.16;
      }
      const playable = duel.phase === 'player' && duel.player.energy >= card.cost;
      drawCardFace(ctx, card, pos.x, pos.y, CARD_W, CARD_H, { playable, hovered, tilt: pos.tilt });
      rects.push({ uid: card.uid, x: pos.x, y: pos.y - (hovered ? 0 : 0), w: CARD_W, h: CARD_H, tilt: pos.tilt });
    });
    return rects;
  }

  function drawPlayedCard(duel, time) {
    const play = duel.lastPlay;
    if (!play) return;
    const age = time - (play.shownAt ?? 0);
    if (age > 2.2) return;
    const pop = Math.min(1, age / 0.25);
    const fade = age > 1.6 ? Math.max(0, 1 - (age - 1.6) / 0.6) : 1;
    const w = 190;
    const h = 264;
    const x = 640 - w / 2;
    const y = 268 + (1 - pop) * 40;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(640, 400);
    ctx.scale(0.7 + 0.3 * pop, 0.7 + 0.3 * pop);
    ctx.translate(-640, -400);
    drawCardFace(ctx, play.card, x, y, w, h, { playable: false, hovered: false, tilt: 0 });
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(play.side === 'player' ? 'You played' : 'Cinder played', 640, 256);
    ctx.restore();
  }

  function drawLog(duel) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '13px Georgia, serif';
    duel.log.forEach((line, i) => {
      ctx.fillStyle = `rgba(255, 235, 200, ${1 - i * 0.18})`;
      ctx.fillText(line, 24, 300 + i * 20);
    });
    ctx.restore();
  }

  function drawTopBar(duel, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, TABLE.width, 52);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('EMBER DUEL', 24, 27);
    ctx.fillStyle = '#fff';
    ctx.font = '15px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Turn ${duel.turn}`, 640, 27);
    ctx.textAlign = 'right';
    ctx.fillText(`Best score ${best}`, TABLE.width - 24, 27);
    ctx.restore();
  }

  function drawDuelistPanel(duel, side, x, y) {
    const isPlayer = side === 'player';
    const d = isPlayer ? duel.player : duel.rival;
    const name = isPlayer ? 'You — Ember' : 'Cinder, the Ash Warden';
    ctx.save();
    // Portrait medallion.
    ctx.beginPath();
    ctx.arc(x + 26, y + 26, 24, 0, Math.PI * 2);
    ctx.fillStyle = isPlayer ? '#ff6b35' : '#7a4a9e';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffd23e';
    ctx.stroke();
    drawSuitIcon(ctx, isPlayer ? 'flame' : 'sword', x + 26, y + 26, 30, '#fff');
    drawHpBar(ctx, x + 62, y + 16, 210, d.hp, START_HP, d.block, name);
    drawEmbers(ctx, x + 62, y + 52, d.energy, ENERGY_PER_TURN);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Deck ${d.drawPile.length}  ·  Discard ${d.discardPile.length}`, x + 62, y + 74);
    ctx.restore();
  }

  function drawEndTurnButton(duel, hovered) {
    const x = TABLE.width - 220;
    const y = 300;
    const w = 190;
    const h = 56;
    ctx.save();
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = duel.phase === 'player' ? (hovered ? '#ff8c4a' : '#ff6b35') : 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffd23e';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('END TURN  (E)', x + w / 2, y + h / 2 + 1);
    ctx.restore();
    return { x, y, w, h };
  }

  function overlay(title, lines, accent, footer, panel = false) {
    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 3, 0.72)';
    ctx.fillRect(0, 0, TABLE.width, TABLE.height);
    if (panel) {
      roundRect(ctx, 220, 170, 840, 330, 18);
      ctx.fillStyle = 'rgba(16, 8, 5, 0.94)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(242, 183, 5, 0.6)';
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText(title, 640, 250);
    ctx.fillStyle = '#fff';
    ctx.font = '19px Georgia, serif';
    lines.forEach((line, i) => ctx.fillText(line, 640, 320 + i * 32));
    if (footer) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 17px Georgia, serif';
      ctx.fillText(footer, 640, 320 + lines.length * 32 + 30);
    }
    ctx.restore();
  }

  return {
    /** Paint one frame. `screen` is one of the SCREEN_* constants. */
    draw(duel, screen, best, opts = {}) {
      const time = opts.time ?? 0;
      const snap = !!opts.snap;
      const hoverUid = opts.hoverUid ?? null;
      ctx.clearRect(0, 0, TABLE.width, TABLE.height);
      drawBackground(time);
      if (screen === SCREEN_TITLE) {
        drawTopBar(duel, best);
        drawRivalHand(duel);
        drawPlayerHand(duel, null, true);
        drawDuelistPanel(duel, 'rival', 24, 60);
        drawDuelistPanel(duel, 'player', 24, 440);
        overlay('EMBER DUEL', [
          'A turn-based card duel against Cinder, the Ash Warden.',
          'Spend embers to play cards: Flame burns, Sword pierces block,',
          'Shield walls you in, Leaf heals and draws. First to 0 life loses.',
          'Click a card or press 1–7 to play it. E ends your turn.',
        ], '#ffd23e', 'Press SPACE or click to begin');
        return { handRects: [], endTurnRect: null };
      }
      drawTopBar(duel, best);
      drawRivalHand(duel);
      drawDuelistPanel(duel, 'rival', 24, 60);
      drawDuelistPanel(duel, 'player', 24, 440);
      drawLog(duel);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawPlayedCard(duel, time);
      const handRects = drawPlayerHand(duel, hoverUid, snap);
      const endTurnRect = drawEndTurnButton(duel, opts.endTurnHovered);
      if (screen === SCREEN_PAUSED) {
        overlay('PAUSED', ['Take a breath. The embers wait.'], '#fff', 'Press P or SPACE to resume');
      } else if (screen === SCREEN_WON) {
        const score = opts.score ?? 0;
        overlay('VICTORY!', [
          `Cinder's flame is out. You win with ${duel.player.hp} life left.`,
          `Score: ${score}  (${duel.player.hp} life × 100, speed bonus included)`,
          `Won in ${duel.turn} turn${duel.turn === 1 ? '' : 's'}. Best score: ${best}.`,
        ], '#ffd23e', 'Press SPACE to duel again', true);
      } else if (screen === SCREEN_LOST) {
        overlay('DEFEAT', [
          'Cinder, the Ash Warden, takes the duel.',
          `You fell on turn ${duel.turn} with Cinder at ${duel.rival.hp} life.`,
          'Shuffle the deck and try a sharper hand.',
        ], '#ff5340', 'Press SPACE to duel again', true);
      }
      return { handRects, endTurnRect };
    },
  };
}
