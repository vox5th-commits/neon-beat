const DEFAULT_MAP = {
  d: 0,
  f: 1,
  j: 2,
  k: 3,
};

/**
 * Keyboard + DOM touch pad + canvas pointer.
 * DOM pad is the reliable path on mobile.
 */
export function createInput(onLaneDown, onLaneUp, getLayout) {
  const held = new Set();
  const keyToLane = { ...DEFAULT_MAP };
  /** @type {Map<number, number>} */
  const pointerLanes = new Map();
  /** @type {Map<string, number>} touch identifier or btn id -> lane */
  const touchLanes = new Map();
  let canvas = null;
  let pad = null;
  let padButtons = [];

  function pressLane(lane) {
    if (lane === undefined || lane < 0 || lane > 3) return;
    if (held.has(lane)) return;
    held.add(lane);
    onLaneDown?.(lane, performance.now());
    syncPadVisual();
  }

  function releaseLane(lane) {
    if (lane === undefined) return;
    // Keep held if any pointer/touch still on this lane
    for (const [, l] of pointerLanes) if (l === lane) return;
    for (const [, l] of touchLanes) if (l === lane) return;
    if (!held.has(lane)) return;
    held.delete(lane);
    onLaneUp?.(lane);
    syncPadVisual();
  }

  function syncPadVisual() {
    for (const btn of padButtons) {
      const lane = Number(btn.dataset.lane);
      btn.classList.toggle("active", held.has(lane));
    }
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
    // keyboard release: only if not held by touch/pointer
    for (const [, l] of pointerLanes) if (l === lane) return;
    for (const [, l] of touchLanes) if (l === lane) return;
    if (!held.has(lane)) return;
    held.delete(lane);
    onLaneUp?.(lane);
    syncPadVisual();
  }

  function laneFromClientX(clientX) {
    const lay = getLayout?.();
    if (!lay || !canvas || !lay.highwayW) return -1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return -1;
    const lx = ((clientX - rect.left) / rect.width) * (canvas.clientWidth || rect.width);
    const left = lay.left;
    const right = lay.left + lay.highwayW;
    if (lx < left - 4 || lx > right + 4) {
      // full-width fallback: divide screen into 4
      const w = canvas.clientWidth || rect.width;
      return Math.min(3, Math.max(0, Math.floor((lx / w) * 4)));
    }
    const rel = Math.min(lay.highwayW - 0.001, Math.max(0, lx - left));
    return Math.min(3, Math.max(0, Math.floor(rel / lay.laneW)));
  }

  function onCanvasPointerDown(e) {
    if (!canvas) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Prefer DOM pad on coarse pointers when pad is visible
    if (pad && !pad.classList.contains("hidden") && e.pointerType === "touch") {
      return;
    }
    const lane = laneFromClientX(e.clientX);
    if (lane < 0) return;
    e.preventDefault();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* */
    }
    pointerLanes.set(e.pointerId, lane);
    pressLane(lane);
  }

  function onCanvasPointerUp(e) {
    const lane = pointerLanes.get(e.pointerId);
    if (lane === undefined) return;
    e.preventDefault();
    pointerLanes.delete(e.pointerId);
    releaseLane(lane);
  }

  function bindPadButton(btn) {
    const lane = Number(btn.dataset.lane);

    const down = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.pointerId != null ? `p${e.pointerId}` : `btn${lane}`;
      touchLanes.set(id, lane);
      try {
        if (e.pointerId != null) btn.setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
      pressLane(lane);
    };

    const up = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = e.pointerId != null ? `p${e.pointerId}` : `btn${lane}`;
      touchLanes.delete(id);
      // safety: clear orphaned ids for this lane
      for (const [k, l] of [...touchLanes]) {
        if (l === lane && k.startsWith("p") === (e.pointerId != null)) {
          /* keep other pointers */
        }
      }
      releaseLane(lane);
    };

    btn.addEventListener("contextmenu", (e) => e.preventDefault());

    // Prefer a single event family to avoid double-fire (pointer + touch)
    if (typeof window.PointerEvent === "function") {
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("lostpointercapture", up);
    } else {
      btn.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          for (const t of e.changedTouches) touchLanes.set(`t${t.identifier}`, lane);
          pressLane(lane);
        },
        { passive: false }
      );
      const touchUp = (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) touchLanes.delete(`t${t.identifier}`);
        releaseLane(lane);
      };
      btn.addEventListener("touchend", touchUp, { passive: false });
      btn.addEventListener("touchcancel", touchUp, { passive: false });
      btn.addEventListener("mousedown", down);
      btn.addEventListener("mouseup", up);
    }
  }

  /**
   * @param {HTMLCanvasElement} canvasEl
   * @param {HTMLElement | null} padEl
   */
  function attach(canvasEl, padEl = null) {
    detach();
    canvas = canvasEl || null;
    pad = padEl || document.getElementById("touch-pad");
    padButtons = pad ? [...pad.querySelectorAll("[data-lane]")] : [];

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    if (canvas) {
      canvas.addEventListener("pointerdown", onCanvasPointerDown);
      canvas.addEventListener("pointerup", onCanvasPointerUp);
      canvas.addEventListener("pointercancel", onCanvasPointerUp);
      canvas.style.touchAction = "none";
    }

    for (const btn of padButtons) bindPadButton(btn);

    if (pad) {
      pad.classList.remove("hidden");
      document.body.classList.add("playing-game");
    }
  }

  function detach() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    if (canvas) {
      canvas.removeEventListener("pointerdown", onCanvasPointerDown);
      canvas.removeEventListener("pointerup", onCanvasPointerUp);
      canvas.removeEventListener("pointercancel", onCanvasPointerUp);
    }
    // pad buttons: clone to drop listeners
    if (pad) {
      pad.classList.add("hidden");
      for (const btn of padButtons) {
        const neo = btn.cloneNode(true);
        btn.parentNode?.replaceChild(neo, btn);
      }
    }
    document.body.classList.remove("playing-game");
    pointerLanes.clear();
    touchLanes.clear();
    held.clear();
    canvas = null;
    pad = null;
    padButtons = [];
  }

  function setPadVisible(v) {
    if (!pad) return;
    pad.classList.toggle("hidden", !v);
  }

  return {
    attach,
    detach,
    setPadVisible,
    isHeld: (lane) => held.has(lane),
    held,
  };
}
