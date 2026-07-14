import { EMBEDDED } from "./embedded-assets.js";

function svgDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function defaultLogo() {
  return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="840" height="280" viewBox="0 0 840 280">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#ff2bd6"/>
    </linearGradient>
  </defs>
  <rect width="840" height="280" rx="24" fill="#0a0218"/>
  <text x="420" y="165" text-anchor="middle" font-family="Orbitron,Arial,sans-serif"
        font-size="92" font-weight="900" fill="url(#g)"
        style="filter:drop-shadow(0 0 12px #00f0ff)">NEON BEAT</text>
  <text x="420" y="215" text-anchor="middle" font-family="Rajdhani,Arial,sans-serif"
        font-size="22" letter-spacing="10" fill="#9a8fb8">4-KEY ARCADE RHYTHM</text>
</svg>`);
}

function defaultJacket(title, c1, c2) {
  return svgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#07010f"/>
  <rect x="24" y="24" width="464" height="464" rx="28" fill="url(#bg)" opacity="0.85"/>
  <g stroke="#00f0ff" stroke-width="2" opacity="0.35">
    ${Array.from({ length: 8 }, (_, i) => {
      const y = 80 + i * 48;
      return `<line x1="40" y1="${y}" x2="472" y2="${y}"/>`;
    }).join("")}
  </g>
  <text x="256" y="270" text-anchor="middle" font-family="Orbitron,Arial,sans-serif"
        font-size="42" font-weight="800" fill="#ffffff">${title}</text>
</svg>`);
}

const FALLBACK_JACKETS = {
  "pulse-drive": defaultJacket("PULSE DRIVE", "#12104a", "#00f0ff"),
  "neon-grid": defaultJacket("NEON GRID", "#2a0a40", "#ff2bd6"),
  "air-on-g": defaultJacket("AIR ON G", "#1a2040", "#d4af37"),
};

export function applyEmbeddedAssets() {
  const logo = document.querySelector(".logo");
  if (logo) logo.src = EMBEDDED.logo || defaultLogo();

  const bg = document.getElementById("bg-layer");
  if (bg) {
    if (EMBEDDED.bgMenu) {
      bg.style.backgroundImage = `
        linear-gradient(180deg, rgba(7, 1, 15, 0.55), rgba(7, 1, 15, 0.88)),
        url("${EMBEDDED.bgMenu}")
      `;
      bg.style.backgroundSize = "cover";
      bg.style.backgroundPosition = "center";
    }
  }
}

export function jacketUrl(songId) {
  if (EMBEDDED.jackets && EMBEDDED.jackets[songId]) {
    return EMBEDDED.jackets[songId];
  }
  if (FALLBACK_JACKETS[songId]) return FALLBACK_JACKETS[songId];
  return defaultJacket(songId.toUpperCase(), "#1a1040", "#00f0ff");
}
