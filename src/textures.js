import * as THREE from 'three';

// Procedural canvas textures. Everything is generated locally so the
// experience ships with no external image assets.
function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = 1, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 2x2 twill carbon weave with per-tow sheen.
export function carbonTexture() {
  const [c, g] = canvas(256);
  const cell = 16;
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      const horiz = ((i + j) & 3) < 2;
      const x = i * cell, y = j * cell;
      const grad = horiz ? g.createLinearGradient(x, y, x, y + cell) : g.createLinearGradient(x, y, x + cell, y);
      const base = horiz ? 30 : 20;
      grad.addColorStop(0, `rgb(${base - 12},${base - 11},${base - 9})`);
      grad.addColorStop(0.5, `rgb(${base + 26},${base + 27},${base + 30})`);
      grad.addColorStop(1, `rgb(${base - 12},${base - 11},${base - 9})`);
      g.fillStyle = grad;
      g.fillRect(x, y, cell, cell);
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
    }
  }
  return toTexture(c);
}

// Hexagonal grille mesh.
export function honeycombTexture() {
  const [c, g] = canvas(256);
  g.fillStyle = '#020203';
  g.fillRect(0, 0, 256, 256);
  const r = 9, h = Math.sqrt(3) * r;
  g.lineWidth = 2.4;
  for (let row = -1; row < 256 / h + 1; row++) {
    for (let col = -1; col < 256 / (r * 1.5) + 1; col++) {
      const cx = col * r * 1.5, cy = row * h + (col & 1 ? h / 2 : 0);
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        g[k ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      g.closePath();
      const grad = g.createLinearGradient(cx, cy - r, cx, cy + r);
      grad.addColorStop(0, '#4a4c52');
      grad.addColorStop(1, '#141518');
      g.strokeStyle = grad;
      g.stroke();
    }
  }
  return toTexture(c, { repeat: 1 });
}

// Fine-grain noise used as a normal map for leather and cast metal.
export function grainNormal(size = 256, strength = 2.2, scale = 1) {
  const [c, g] = canvas(size);
  const hgt = new Float32Array(size * size);
  for (let i = 0; i < hgt.length; i++) hgt[i] = Math.random();
  // two blur passes for organic pebbling
  for (let pass = 0; pass < 2 * scale; pass++) {
    const out = new Float32Array(hgt.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += hgt[((y + dy + size) % size) * size + ((x + dx + size) % size)];
      out[y * size + x] = s / 9;
    }
    hgt.set(out);
  }
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = (hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x - 1 + size) % size)]) * strength;
    const dy = (hgt[((y + 1) % size) * size + x] - hgt[((y - 1 + size) % size) * size + x]) * strength;
    const nz = 1 / Math.sqrt(dx * dx + dy * dy + 1);
    img.data[i * 4] = (-dx * nz * 0.5 + 0.5) * 255;
    img.data[i * 4 + 1] = (-dy * nz * 0.5 + 0.5) * 255;
    img.data[i * 4 + 2] = nz * 255;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return toTexture(c, { srgb: false });
}

// Leather with quilted stitch lines (used on seats).
export function leatherTexture(base = '#6a3a1e', stitch = '#d9c39a') {
  const [c, g] = canvas(256);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.45)';
  g.lineWidth = 3;
  for (let y = 32; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  g.strokeStyle = stitch;
  g.lineWidth = 1.2;
  g.setLineDash([4, 3]);
  for (let y = 32; y < 256; y += 64) {
    for (const o of [-5, 5]) { g.beginPath(); g.moveTo(0, y + o); g.lineTo(256, y + o); g.stroke(); }
  }
  return toTexture(c);
}

// Cross-drilled carbon-ceramic brake disc face (planar cap mapping).
export function discTexture() {
  const [c, g] = canvas(512);
  const cx = 256;
  const grad = g.createRadialGradient(cx, cx, 120, cx, cx, 256);
  grad.addColorStop(0, '#3a3b3e');
  grad.addColorStop(1, '#55575b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},255,0.04)`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  g.fillStyle = '#0c0c0d';
  for (let ring = 0; ring < 3; ring++) {
    const r = 150 + ring * 34;
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2 + ring * 0.11;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cx + Math.sin(a) * r, 5, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let r = 130; r < 256; r += 3) { g.beginPath(); g.arc(cx, cx, r, 0, Math.PI * 2); g.stroke(); }
  return toTexture(c);
}

// Instrument dial with fine graduations.
export function gaugeTexture(major = 9) {
  const [c, g] = canvas(256);
  g.fillStyle = '#050608';
  g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.strokeStyle = '#d8d2c4';
  for (let i = 0; i <= major * 5; i++) {
    const a = -Math.PI * 1.25 + (i / (major * 5)) * Math.PI * 1.5;
    const long = i % 5 === 0;
    g.lineWidth = long ? 3 : 1;
    g.beginPath();
    g.moveTo(Math.cos(a) * (long ? 96 : 104), Math.sin(a) * (long ? 96 : 104));
    g.lineTo(Math.cos(a) * 114, Math.sin(a) * 114);
    g.stroke();
  }
  g.strokeStyle = '#c9a56b';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(Math.cos(-2.2) * 90, Math.sin(-2.2) * 90);
  g.stroke();
  g.strokeStyle = 'rgba(201,165,107,0.5)';
  g.lineWidth = 1;
  g.beginPath(); g.arc(0, 0, 120, 0, Math.PI * 2); g.stroke();
  return toTexture(c, { repeat: 1 });
}

// Radiator / intercooler fin core.
export function finTexture() {
  const [c, g] = canvas(128);
  g.fillStyle = '#26282c';
  g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 4) {
    g.fillStyle = '#7d8189';
    g.fillRect(x, 0, 1.5, 128);
  }
  for (let y = 0; y < 128; y += 32) {
    g.fillStyle = '#0d0e10';
    g.fillRect(0, y, 128, 3);
  }
  return toTexture(c, { repeat: 4 });
}

// Soft radial falloff (contact shadow, glows).
export function radialTexture(inner = 'rgba(0,0,0,0.85)', outer = 'rgba(0,0,0,0)', size = 256) {
  const [c, g] = canvas(size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.55, inner.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.55})`));
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = toTexture(c, { repeat: 1 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
