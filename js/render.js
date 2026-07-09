import { LANE_COLORS } from "./fx.js";

const KEYS = ["D", "F", "J", "K"];

function isCompact() {
  return typeof window !== "undefined" && window.innerWidth <= 720;
}

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
    const mobile = isCompact();
    // Phone: use almost full width; desktop: centered column
    const highwayW = mobile
      ? Math.min(w * 0.96, w - 8)
      : Math.min(420, w * 0.55);
    const left = (w - highwayW) / 2;
    const laneW = highwayW / 4;
    // Mobile: judgment line higher so fingers don't cover notes as much
    const judgeY = mobile ? h * 0.72 : h * 0.82;
    const touchTop = mobile ? h * 0.55 : judgeY - 20;
    return { highwayW, left, laneW, judgeY, touchTop, mobile };
  }

  function drawBackground(now, bpm = 128) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0a0218");
    g.addColorStop(1, "#05010c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const beat = (now * (bpm / 60)) % 1;
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

    if (!isCompact()) {
      const vg = ctx.createLinearGradient(0, 0, w, 0);
      vg.addColorStop(0, "rgba(0,0,0,0.75)");
      vg.addColorStop(0.3, "rgba(0,0,0,0)");
      vg.addColorStop(0.7, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,0.75)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawHighway(heldLanes, lay) {
    const { left, laneW, judgeY, highwayW, touchTop, mobile } = lay;

    ctx.fillStyle = "rgba(12, 6, 30, 0.82)";
    ctx.fillRect(left - (mobile ? 2 : 8), 0, highwayW + (mobile ? 4 : 16), h);

    ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(left - (mobile ? 2 : 8), 0, highwayW + (mobile ? 4 : 16), h);

    for (let i = 0; i < 4; i++) {
      const x = left + i * laneW;
      const held = heldLanes?.has?.(i);
      ctx.fillStyle = held
        ? `rgba(${hexToRgb(LANE_COLORS[i])}, 0.16)`
        : "rgba(255,255,255,0.02)";
      ctx.fillRect(x, 0, laneW, h);

      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();

      // Large touch pad zone (especially mobile)
      if (mobile) {
        ctx.fillStyle = held
          ? `rgba(${hexToRgb(LANE_COLORS[i])}, 0.28)`
          : `rgba(${hexToRgb(LANE_COLORS[i])}, 0.1)`;
        ctx.fillRect(x + 2, touchTop, laneW - 4, h - touchTop - 4);
        ctx.strokeStyle = LANE_COLORS[i];
        ctx.globalAlpha = held ? 0.95 : 0.45;
        ctx.lineWidth = held ? 3 : 1.5;
        ctx.strokeRect(x + 3, touchTop + 2, laneW - 6, h - touchTop - 8);
        ctx.globalAlpha = 1;
      }

      const rx = x + (mobile ? 6 : 8);
      const rw = laneW - (mobile ? 12 : 16);
      const ry = judgeY - (mobile ? 14 : 12);
      const rh = mobile ? 28 : 24;
      ctx.save();
      ctx.shadowColor = LANE_COLORS[i];
      ctx.shadowBlur = held ? 22 : 8;
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = held ? 3 : 2;
      ctx.globalAlpha = held ? 1 : 0.65;
      roundRect(ctx, rx, ry, rw, rh, 8);
      ctx.stroke();
      if (held) {
        ctx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, 0.25)`;
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.font = mobile ? "700 18px Orbitron, sans-serif" : "700 16px Orbitron, sans-serif";
      ctx.textAlign = "center";
      const labelY = mobile ? Math.min(h - 18, (touchTop + h) / 2 + 6) : judgeY + 40;
      ctx.fillText(KEYS[i], x + laneW / 2, labelY);
    }

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 16;
    ctx.lineWidth = mobile ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(left, judgeY);
    ctx.lineTo(left + highwayW, judgeY);
    ctx.stroke();
    ctx.restore();
  }

  function drawNote(note, now, pixelsPerSec, lay, opts = {}) {
    const { left, laneW, judgeY, mobile } = lay;
    const color = LANE_COLORS[note.lane];
    const pad = mobile ? 6 : 10;
    const x = left + note.lane * laneW + pad;
    const nw = laneW - pad * 2;
    const isLong = note.dur > 0.05;
    const nh = mobile ? 26 : 22;

    if (isLong) {
      const yHead = judgeY - (note.t - now) * pixelsPerSec;
      const yTail = judgeY - (note.t + note.dur - now) * pixelsPerSec;
      const top = Math.min(yHead, yTail);
      const bot = Math.max(yHead, yTail);
      if (bot < -40 || top > h + 40) return;

      const holding = opts.holding || note.holding;
      ctx.save();
      ctx.globalAlpha = holding ? 0.95 : 0.75;
      ctx.fillStyle = `rgba(${hexToRgb(color)}, 0.35)`;
      const bodyTop = holding ? Math.min(judgeY, bot) : top;
      const bodyBot = holding ? judgeY : bot;
      roundRect(ctx, x + 4, bodyTop, nw - 8, Math.max(8, bodyBot - bodyTop), 6);
      ctx.fill();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color;
      roundRect(ctx, x, yHead - nh / 2, nw, nh, 9);
      ctx.fill();
      roundRect(ctx, x, yTail - nh / 2 + 2, nw, nh - 4, 8);
      ctx.fill();
      ctx.restore();
      return;
    }

    const dt = note.t - now;
    const y = judgeY - dt * pixelsPerSec;
    if (y < -40 || y > h + 40) return;

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

  function drawHud(stats, songTitle, diffName, extra = {}) {
    const mobile = isCompact();
    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = mobile ? "600 14px Rajdhani, sans-serif" : "600 18px Rajdhani, sans-serif";
    ctx.fillText(songTitle, 12, mobile ? 22 : 36);
    ctx.fillStyle = "rgba(0,240,255,0.85)";
    ctx.font = mobile ? "700 11px Orbitron, sans-serif" : "700 14px Orbitron, sans-serif";
    ctx.fillText(diffName.toUpperCase(), 12, mobile ? 40 : 58);

    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = mobile ? "700 20px Orbitron, sans-serif" : "700 28px Orbitron, sans-serif";
    ctx.fillText(String(stats.score).padStart(7, "0"), w - 12, mobile ? 26 : 42);

    const acc = stats.judged ? (stats.accSum / stats.judged).toFixed(2) : "100.00";
    ctx.font = mobile ? "600 13px Rajdhani, sans-serif" : "600 16px Rajdhani, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`${acc}%`, w - 12, mobile ? 46 : 68);

    const prog = extra.progress || 0;
    const barW = mobile ? Math.min(120, w * 0.35) : 160;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(12, mobile ? 52 : 72, barW, 5);
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(12, mobile ? 52 : 72, barW * prog, 5);

    if (extra.lifeEnabled !== false) {
      const life = stats.life / (stats.maxLife || 100);
      const lifeW = mobile ? Math.min(140, w * 0.4) : 180;
      const ly = mobile ? h - 28 : h - 36;
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(12, ly, lifeW, mobile ? 8 : 10);
      ctx.fillStyle = life > 0.3 ? "#7dff6a" : "#ff4d6d";
      ctx.fillRect(12, ly, lifeW * life, mobile ? 8 : 10);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "600 11px Rajdhani, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("LIFE", 12, ly - 4);
    }

    if (stats.combo > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#ff2bd6";
      ctx.shadowBlur = 12;
      ctx.font = mobile ? "900 36px Orbitron, sans-serif" : "900 48px Orbitron, sans-serif";
      ctx.fillText(String(stats.combo), w / 2, h * (mobile ? 0.2 : 0.28));
      ctx.shadowBlur = 0;
      ctx.font = "700 12px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(255,43,214,0.9)";
      ctx.fillText("COMBO", w / 2, h * (mobile ? 0.2 : 0.28) + 18);
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
