import { LANE_COLORS } from "./fx.js";

const KEYS = ["D", "F", "J", "K"];

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layout() {
    const highwayW = Math.min(420, w * 0.55);
    const left = (w - highwayW) / 2;
    const laneW = highwayW / 4;
    const judgeY = h * 0.82;
    return { highwayW, left, laneW, judgeY };
  }

  function drawBackground(now, bpm = 128) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a0218");
    g.addColorStop(1, "#05010c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const beat = ((now * (bpm / 60)) % 1);
    const pulse = 0.04 + 0.03 * Math.sin(beat * Math.PI * 2);

    ctx.save();
    ctx.globalAlpha = 0.18 + pulse;
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1;
    const spacing = 36;
    const scroll = (now * 40) % spacing;
    for (let y = -spacing; y < h; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y + scroll);
      ctx.lineTo(w, y + scroll);
      ctx.stroke();
    }
    ctx.restore();

    // side vignette
    const vg = ctx.createLinearGradient(0, 0, w, 0);
    vg.addColorStop(0, "rgba(0,0,0,0.75)");
    vg.addColorStop(0.3, "rgba(0,0,0,0)");
    vg.addColorStop(0.7, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawHighway(heldLanes, lay) {
    const { left, laneW, judgeY, highwayW } = lay;

    ctx.fillStyle = "rgba(12, 6, 30, 0.82)";
    ctx.fillRect(left - 8, 0, highwayW + 16, h);

    ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(left - 8, 0, highwayW + 16, h);

    for (let i = 0; i < 4; i++) {
      const x = left + i * laneW;
      const held = heldLanes?.has?.(i);
      ctx.fillStyle = held
        ? `rgba(${hexToRgb(LANE_COLORS[i])}, 0.14)`
        : "rgba(255,255,255,0.02)";
      ctx.fillRect(x, 0, laneW, h);

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // receptor
      const rx = x + 8;
      const rw = laneW - 16;
      const ry = judgeY - 12;
      ctx.save();
      ctx.shadowColor = LANE_COLORS[i];
      ctx.shadowBlur = held ? 22 : 8;
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = held ? 3 : 2;
      ctx.globalAlpha = held ? 1 : 0.65;
      roundRect(ctx, rx, ry, rw, 24, 8);
      ctx.stroke();
      if (held) {
        ctx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, 0.25)`;
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "700 16px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(KEYS[i], x + laneW / 2, judgeY + 40);
    }

    // judgment line glow
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 16;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, judgeY);
    ctx.lineTo(left + highwayW, judgeY);
    ctx.stroke();
    ctx.restore();
  }

  function drawNote(note, now, pixelsPerSec, lay) {
    const { left, laneW, judgeY } = lay;
    const dt = note.t - now;
    const y = judgeY - dt * pixelsPerSec;
    if (y < -40 || y > h + 40) return;

    const x = left + note.lane * laneW + 10;
    const nw = laneW - 20;
    const nh = 22;
    const color = LANE_COLORS[note.lane];

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    const grad = ctx.createLinearGradient(x, y - nh, x, y + nh);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, shade(color, 0.45));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y - nh / 2, nw, nh, 9);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(stats, songTitle, diffName) {
    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "600 18px Rajdhani, sans-serif";
    ctx.fillText(songTitle, 24, 36);
    ctx.fillStyle = "rgba(0,240,255,0.85)";
    ctx.font = "700 14px Orbitron, sans-serif";
    ctx.fillText(diffName.toUpperCase(), 24, 58);

    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "700 28px Orbitron, sans-serif";
    ctx.fillText(String(stats.score).padStart(7, "0"), w - 24, 42);

    const acc = stats.judged ? (stats.accSum / stats.judged).toFixed(2) : "100.00";
    ctx.font = "600 16px Rajdhani, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`${acc}%`, w - 24, 68);

    if (stats.combo > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#ff2bd6";
      ctx.shadowBlur = 12;
      ctx.font = "900 48px Orbitron, sans-serif";
      ctx.fillText(String(stats.combo), w / 2, h * 0.28);
      ctx.shadowBlur = 0;
      ctx.font = "700 14px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(255,43,214,0.9)";
      ctx.fillText("COMBO", w / 2, h * 0.28 + 22);
    }
    ctx.restore();
  }

  function notePos(lane, lay) {
    return {
      x: lay.left + lane * lay.laneW + lay.laneW / 2,
      y: lay.judgeY,
    };
  }

  return {
    resize,
    layout,
    drawBackground,
    drawHighway,
    drawNote,
    drawHud,
    notePos,
    get ctx() {
      return ctx;
    },
    get size() {
      return { w, h };
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function shade(hex, factor) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  const r = Math.floor(((n >> 16) & 255) * factor);
  const g = Math.floor(((n >> 8) & 255) * factor);
  const b = Math.floor((n & 255) * factor);
  return `rgb(${r},${g},${b})`;
}
