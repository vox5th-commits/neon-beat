const DEFAULT_MAP = {
  d: 0,
  f: 1,
  j: 2,
  k: 3,
};

/**
 * Keyboard + multi-touch / mouse via Pointer Events.
 * @param {(lane:number, t:number)=>void} onLaneDown
 * @param {(lane:number)=>void} onLaneUp
 * @param {() => { left:number, laneW:number, highwayW:number, judgeY:number } | null} getLayout
 */
export function createInput(onLaneDown, onLaneUp, getLayout) {
  const held = new Set();
  const keyToLane = { ...DEFAULT_MAP };
  /** @type {Map<number, number>} pointerId -> lane */
  const pointerLanes = new Map();
  let target = null;

  function pressLane(lane) {
    if (lane === undefined || lane < 0 || lane > 3) return;
    if (held.has(lane)) return;
    held.add(lane);
    onLaneDown?.(lane, performance.now());
  }

  function releaseLane(lane) {
    if (lane === undefined) return;
    if (!held.has(lane)) return;
    // Only release if no other pointer still holding this lane
    for (const [, l] of pointerLanes) {
      if (l === lane) return;
    }
    held.delete(lane);
    onLaneUp?.(lane);
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    const lane = keyToLane[e.key.toLowerCase()];
    if (lane === undefined) return;
    e.preventDefault();
    pressLane(lane);
  }

  function onKeyUp(e) {
    const lane = keyToLane[e.key.toLowerCase()];
    if (lane === undefined) return;
    e.preventDefault();
    // keyboard doesn't use pointerLanes
    if (!held.has(lane)) return;
    let still = false;
    for (const [, l] of pointerLanes) {
      if (l === lane) still = true;
    }
    if (still) return;
    held.delete(lane);
    onLaneUp?.(lane);
  }

  function laneFromClientX(clientX) {
    const lay = getLayout?.();
    if (!lay || !target) return -1;
    const rect = target.getBoundingClientRect();
    const x = clientX - rect.left;
    // scale if CSS size != layout space (layout uses clientWidth coords)
    const scaleX = target.clientWidth / rect.width || 1;
    const lx = x * scaleX;
    if (lx < lay.left || lx >= lay.left + lay.highwayW) {
      // allow slight padding outside highway on mobile
      const pad = lay.laneW * 0.15;
      if (lx < lay.left - pad || lx >= lay.left + lay.highwayW + pad) return -1;
    }
    const rel = Math.min(lay.highwayW - 0.001, Math.max(0, lx - lay.left));
    return Math.min(3, Math.max(0, Math.floor(rel / lay.laneW)));
  }

  function onPointerDown(e) {
    if (!target) return;
    // Only primary buttons for mouse; all touches ok
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const lane = laneFromClientX(e.clientX);
    if (lane < 0) return;
    e.preventDefault();
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
    pointerLanes.set(e.pointerId, lane);
    pressLane(lane);
  }

  function onPointerUp(e) {
    const lane = pointerLanes.get(e.pointerId);
    if (lane === undefined) return;
    e.preventDefault();
    pointerLanes.delete(e.pointerId);
    releaseLane(lane);
    try {
      target?.releasePointerCapture(e.pointerId);
    } catch {
      /* */
    }
  }

  function onPointerCancel(e) {
    onPointerUp(e);
  }

  function attach(el) {
    target = el || null;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    if (target) {
      target.addEventListener("pointerdown", onPointerDown);
      target.addEventListener("pointerup", onPointerUp);
      target.addEventListener("pointercancel", onPointerCancel);
      target.style.touchAction = "none";
    }
  }

  function detach() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (target) {
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("pointercancel", onPointerCancel);
    }
    pointerLanes.clear();
    held.clear();
    target = null;
  }

  function isHeld(lane) {
    return held.has(lane);
  }

  return { attach, detach, isHeld, held };
}
