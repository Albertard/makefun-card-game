// Ember Duel — tiny WebAudio synth: no sound files, every effect is a few
// oscillators. Sound is optional and never blocks the game.

let audio = null;

function ensureAudio() {
  if (audio) return audio;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  } catch {
    audio = null;
  }
  return audio;
}

function tone(freq, when, length, type, gainValue) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(gainValue, ctx.currentTime + when);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + length);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime + when);
  osc.stop(ctx.currentTime + when + length + 0.02);
}

export const SOUNDS = {
  play: () => { tone(520, 0, 0.09, 'triangle', 0.12); tone(780, 0.05, 0.12, 'triangle', 0.1); },
  hit: () => { tone(180, 0, 0.14, 'sawtooth', 0.12); tone(120, 0.06, 0.16, 'sawtooth', 0.1); },
  block: () => { tone(240, 0, 0.1, 'square', 0.06); tone(320, 0.06, 0.12, 'square', 0.05); },
  heal: () => { tone(660, 0, 0.12, 'sine', 0.1); tone(880, 0.08, 0.16, 'sine', 0.09); },
  draw: () => { tone(440, 0, 0.06, 'triangle', 0.07); },
  turn: () => { tone(392, 0, 0.1, 'triangle', 0.09); tone(523, 0.09, 0.14, 'triangle', 0.09); },
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.22, 'triangle', 0.12)); },
  lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.14, 0.24, 'sine', 0.1)); },
};

export function playSound(name) {
  const fn = SOUNDS[name];
  if (fn) {
    try { fn(); } catch { /* sound never breaks the game */ }
  }
}
