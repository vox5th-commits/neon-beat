import { LANE_COLORS } from "./fx.js";

const KEYS = ["D", "F", "J", "K"];

function isCompact() {
  return typeof window !== "undefined" && window.innerWidth <= 900;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Never larger than visual viewport
    const vw = Math.max(1, Math.floor(window.innerWidth || 1));
    const vh = Math.max(1, Math.floor(window.innerHeight || 1));
    const cw = Math.max(1, Math.floor(canvas.clientWidth || vw));
    const ch = Math.max(1, Math.floor(canvas.clientHeight || vh));
    w = Math.min(cw, vw);
    h = Math.min(ch, vh);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function layout() {
    const mobile = isCompact();
    // Side margins always ≥ 8px; never bleed past canvas
    const side = mobile ? 8 : Math.max(12, Math.floor(w * 0.06));
    const highwayW = Math.max(80, Math.min(w - side * 2, mobile ? w - side * 2 : Math.min(400, Math.floor(w * 0.5))));
    const left = Math.floor((w - highwayW) / 2);
    const laneW = highwayW / 4;
    // Leave room for DOM touch pad (~26% + safe area)
    const padH = mobile ? Math.floor(h * 0.26) : Math.floor(h * 0.12);
    const judgeY = Math.min(h - padH - 12, Math.floor(h * (mobile ? 0.68 : 0.8)));
    const touchTop = h - padH;
    return { highwayW, left, laneW, judgeY, touchTop, mobile, padH };
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
    ctx.globalAlpha = 0.14 + pulse;
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
  }

  function drawHighway(heldLanes, lay) {
    const { left, laneW, judgeY, highwayW, mobile } = lay;

    // Clip to canvas
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    ctx.fillStyle = "rgba(12, 6, 30, 0.88)";
    ctx.fillRect(left, 0, highwayW, h);

    ctx.strokeStyle = "rgba(0, 240, 255, 0.3)";
    ctx.lineWidth = 2;
    // Inset stroke so it stays inside
    ctx.strokeRect(left + 1, 1, highwayW - 2, h - 2);

    for (let i = 0; i < 4; i++) {
      const x = left + i * laneW;
      const held = heldLanes?.has?.(i);
      ctx.fillStyle = held
        ? `rgba(${hexToRgb(LANE_COLORS[i])}, 0.18)`
        : i % 2 === 0
          ? "rgba(255,255,255,0.03)"
          : "rgba(255,255,255,0.01)";
      ctx.fillRect(x, 0, laneW, h);

      if (i > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      const rx = x + 4;
      const rw = Math.max(8, laneW - 8);
      const ry = judgeY - (mobile ? 12 : 10);
      const rh = mobile ? 26 : 22;
      ctx.save();
      ctx.shadowColor = LANE_COLORS[i];
      ctx.shadowBlur = held ? 16 : 6;
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = held ? 3 : 2;
      ctx.globalAlpha = held ? 1 : 0.7;
      roundRect(ctx, rx, ry, rw, rh, 8);
      ctx.stroke();
      if (held) {
        ctx.fillStyle = `rgba(${hexToRgb(LANE_COLORS[i])}, 0.28)`;
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 12;
    ctx.lineWidth = mobile ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(left + 2, judgeY);
    ctx.lineTo(left + highwayW - 2, judgeY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function drawNote(note, now, pixelsPerSec, lay, opts = {}) {
    const { left, laneW, judgeY, mobile } = lay;
    const color = LANE_COLORS[note.lane];
    const pad = mobile ? 5 : 8;
    const x = left + note.lane * laneW + pad;
    const nw = Math.max(6, laneW - pad * 2);
    const isLong = note.dur > 0.05;
    const nh = mobile ? 24 : 20;

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
      roundRect(ctx, x + 3, bodyTop, nw - 6, Math.max(8, bodyBot - bodyTop), 6);
      ctx.fill();
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = color;
      roundRect(ctx, x, yHead - nh / 2, nw, nh, 8);
      ctx.fill();
      roundRect(ctx, x, yTail - nh / 2 + 2, nw, nh - 4, 7);
      ctx.fill();
      ctx.restore();
      return;
    }

    const y = judgeY - (note.t - now) * pixelsPerSec;
    if (y < -40 || y > h + 40) return;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(x, y - nh, x, y + nh);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, shade(color, 0.45));
    ctx.fillStyle = grad;
    roundRect(ctx, x, y - nh / 2, nw, nh, 8);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(stats, songTitle, diffName, extra = {}) {
    const mobile = isCompact();
    ctx.save();
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = mobile ? "600 13px Rajdhani, sans-serif" : "600 18px Rajdhani, sans-serif";
    const title = String(songTitle || "").slice(0, mobile ? 18 : 40);
    ctx.fillText(title, 10, mobile ? 18 : 32);
    ctx.fillStyle = "rgba(0,240,255,0.9)";
    ctx.font = mobile ? "700 10px Orbitron, sans-serif" : "700 14px Orbitron, sans-serif";
    ctx.fillText(String(diffName || "").toUpperCase(), 10, mobile ? 34 : 52);

    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = mobile ? "700 18px Orbitron, sans-serif" : "700 28px Orbitron, sans-serif";
    ctx.fillText(String(stats.score).padStart(7, "0"), w - 10, mobile ? 20 : 38);

    const acc = stats.judged ? (stats.accSum / stats.judged).toFixed(1) : "100.0";
    ctx.font = mobile ? "600 12px Rajdhani, sans-serif" : "600 16px Rajdhani, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(`${acc}%`, w - 10, mobile ? 38 : 60);

    const prog = extra.progress || 0;
    const barW = Math.min(mobile ? 100 : 160, w * 0.35);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(10, mobile ? 42 : 66, barW, 4);
    ctx.fillStyle = "#00f0ff";
    ctx.fillRect(10, mobile ? 42 : 66, barW * prog, 4);

    if (extra.lifeEnabled !== false) {
      const life = stats.life / (stats.maxLife || 100);
      const lifeW = Math.min(mobile ? 110 : 180, w * 0.38);
      // Keep life bar above touch pad
      const ly = Math.max(60, (extra.touchTop || h * 0.74) - 22);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(10, ly, lifeW, 7);
      ctx.fillStyle = life > 0.3 ? "#7dff6a" : "#ff4d6d";
      ctx.fillRect(10, ly, lifeW * life, 7);
    }

    if (stats.combo > 1) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#ff2bd6";
      ctx.shadowBlur = 10;
      ctx.font = mobile ? "900 32px Orbitron, sans-serif" : "900 48px Orbitron, sans-serif";
      ctx.fillText(String(stats.combo), w / 2, h * (mobile ? 0.18 : 0.26));
      ctx.shadowBlur = 0;
      ctx.font = "700 11px Orbitron, sans-serif";
      ctx.fillStyle = "rgba(255,43,214,0.9)";
      ctx.fillText("COMBO", w / 2, h * (mobile ? 0.18 : 0.26) + 16);
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
