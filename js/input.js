const DEFAULT_MAP = {
  d: 0,
  f: 1,
  j: 2,
  k: 3,
};

export function createInput(onLaneDown, onLaneUp) {
  const held = new Set();
  const keyToLane = { ...DEFAULT_MAP };

  function onKeyDown(e) {
    if (e.repeat) return;
    const lane = keyToLane[e.key.toLowerCase()];
    if (lane === undefined) return;
    e.preventDefault();
    if (held.has(lane)) return;
    held.add(lane);
    onLaneDown?.(lane, performance.now());
  }

  function onKeyUp(e) {
    const lane = keyToLane[e.key.toLowerCase()];
    if (lane === undefined) return;
    e.preventDefault();
    held.delete(lane);
    onLaneUp?.(lane);
  }

  function attach() {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
  }

  function detach() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    held.clear();
  }

  function isHeld(lane) {
    return held.has(lane);
  }

  return { attach, detach, isHeld, held };
}
