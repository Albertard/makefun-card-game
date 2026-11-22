// Ember Duel — mouse and keyboard input, read once per frame.
// Click a card to play it (or press 1–7 for the cards in hand), Space/Enter to
// confirm or to start, E or the End Turn button to end the turn, P to pause.

export const ACTION_CONFIRM = 1;
export const ACTION_END_TURN = 2;
export const ACTION_PAUSE = 4;

export function createInput(canvas) {
  let actions = 0;
  let mouse = { x: -1, y: -1, clicked: false, clickX: -1, clickY: -1 };
  let numberKey = 0;

  function toGame(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 800,
    };
  }

  canvas.addEventListener('mousemove', (event) => {
    const p = toGame(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('click', (event) => {
    const p = toGame(event);
    mouse.clickX = p.x;
    mouse.clickY = p.y;
    mouse.clicked = true;
  });
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'enter') actions |= ACTION_CONFIRM;
    else if (key === 'e') actions |= ACTION_END_TURN;
    else if (key === 'p' || key === 'escape') actions |= ACTION_PAUSE;
    else if (key >= '1' && key <= '7') numberKey = Number.parseInt(key, 10);
  });

  return {
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeNumberKey() {
      const taken = numberKey;
      numberKey = 0;
      return taken;
    },
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    mousePosition() {
      return { x: mouse.x, y: mouse.y };
    },
  };
}
