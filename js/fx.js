const LANE_COLORS = ["#00f0ff", "#7dff6a", "#ffc14a", "#ff2bd6"];

export function createFx() {
  const particles = [];
  const flashes = [];
  const judgments = [];
  const MAX_P = 220;

  function spawnHit(x, y, lane, intensity = 1) {
    const color = LANE_COLORS[lane] || "#fff";
    const count = Math.floor(10 + 12 * intensity);
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_P) particles.shift();
      const ang = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 220 * intensity;
      particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.35 + Math.random() * 0.25,
        age: 0,
        r: 2 + Math.random() * 3,
        color,
      });
    }
    flashes.push({ x, y, lane, life: 0.18, age: 0, color });
  }

  function spawnJudge(text, color, x, y) {
    judgments.push({ text, color, x, y, life: 0.55, age: 0 });
  }

  function spawnMilestone(combo) {
    judgments.push({
      text: `${combo} COMBO!`,
      color: "#ff2bd6",
      x: typeof window !== "undefined" ? window.innerWidth / 2 : 400,
      y: typeof window !== "undefined" ? window.innerHeight * 0.22 : 120,
      life: 0.9,
      age: 0,
      big: true,
    });
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      if (p.age >= p.life) particles.splice(i, 1);
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].age += dt;
      if (flashes[i].age >= flashes[i].life) flashes.splice(i, 1);
    }
    for (let i = judgments.length - 1; i >= 0; i--) {
      judgments[i].age += dt;
      judgments[i].y -= 40 * dt;
      if (judgments[i].age >= judgments[i].life) judgments.splice(i, 1);
    }
  }

  function draw(ctx) {
    for (const f of flashes) {
      const t = 1 - f.age / f.life;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 18 + (1 - t) * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of particles) {
      const t = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const j of judgments) {
      const t = 1 - j.age / j.life;
      ctx.save();
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.font = j.big ? "900 42px Orbitron, sans-serif" : "900 34px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = j.color;
      ctx.shadowColor = j.color;
      ctx.shadowBlur = 12;
      const lines = String(j.text).split("\n");
      lines.forEach((line, i) => ctx.fillText(line, j.x, j.y + i * 28));
      ctx.restore();
    }
  }

  function clear() {
    particles.length = 0;
    flashes.length = 0;
    judgments.length = 0;
  }

  return { spawnHit, spawnJudge, spawnMilestone, update, draw, clear, LANE_COLORS };
}

export { LANE_COLORS };
