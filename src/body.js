import * as THREE from 'three';
import { curve, clamp, lerp } from './util.js';

// ---------------------------------------------------------------------------
// Parametric body surface. The exterior is one continuous loft S(u, v):
//   u: 0 at the nose → 1 at the tail
//   v: 0 right sill → 0.5 roof centre-line → 1 left sill
// Every body panel is cut from this same surface, so assembled panels meet
// exactly and the exploded view separates real, adjoining pieces.
// ---------------------------------------------------------------------------
export const X_FRONT = 2.25;
export const X_REAR = -2.2;
export const LEN = X_FRONT - X_REAR;
export const FRONT_AXLE = 1.355;
export const REAR_AXLE = -1.355;
export const uAtX = (x) => (X_FRONT - x) / LEN;
export const xAtU = (u) => X_FRONT - LEN * u;

const uFA = uAtX(FRONT_AXLE), uRA = uAtX(REAR_AXLE);

const HALF_W = curve([[0, 0.72], [0.035, 0.86], [0.1, 0.96], [uFA, 1.0], [0.33, 0.975], [0.45, 0.945], [0.6, 0.975], [0.72, 1.02], [uRA, 1.025], [0.93, 0.98], [1, 0.9]]);
const SHOULDER = curve([[0, 0.44], [0.08, 0.52], [uFA, 0.6], [0.36, 0.57], [0.55, 0.58], [uRA, 0.66], [0.95, 0.68], [1, 0.66]]);
const TOP = curve([[0, 0.58], [0.05, 0.65], [uFA, 0.74], [0.3, 0.8], [0.45, 0.86], [0.62, 0.9], [0.75, 0.97], [0.88, 0.99], [0.96, 0.98], [1, 0.95]]);
const SILL = curve([[0, 0.17], [0.08, 0.14], [0.3, 0.12], [0.7, 0.12], [0.92, 0.16], [1, 0.22]]);
// Raised fender crowns over each axle give the car its muscular haunches.
const FENDER = (u) => 0.13 * Math.exp(-(((u - uFA) / 0.1) ** 2)) + 0.12 * Math.exp(-(((u - uRA) / 0.11) ** 2)) + 0.03;

const TH_B = 0.32 * Math.PI;
const NE = 3.0, NE_LOW = 6.0, NT = 3.4, NB = 3.0;

export function bodyPoint(u, v, out = new THREE.Vector3()) {
  const w = HALF_W(u), ys = SHOULDER(u), yt = TOP(u), yb = SILL(u);
  const a = -TH_B + (Math.PI + 2 * TH_B) * v;
  const c = Math.cos(a), s = Math.sin(a);
  let y, z;
  if (s >= 0) {
    z = w * Math.sign(c) * Math.pow(Math.abs(c), 2 / NE);
    const sn = Math.abs(z) / w;
    y = ys + (yt - ys) * Math.pow(s, 2 / NT) + FENDER(u) * Math.exp(-(((sn - 0.78) / 0.17) ** 2)) * Math.pow(s, 0.4);
  } else {
    z = w * Math.sign(c) * Math.pow(Math.abs(c), 2 / NE_LOW);
    y = ys - (ys - yb) * Math.pow(Math.abs(s) / Math.sin(TH_B), 2 / NB);
  }
  return out.set(xAtU(u), y, z);
}

// Rounded nose / tail caps: the end sections are shrunk toward their centre
// while being pushed outward, closing the loft with a soft radius.
const NOSE_R = 0.13, TAIL_R = 0.06;
function capPoint(end, k, v, out) {
  const u = end === 'front' ? 0 : 1;
  bodyPoint(u, v, out);
  const yc = end === 'front' ? 0.37 : 0.5;
  const phi = k * Math.PI * 0.5;
  const sc = Math.cos(phi);
  out.y = yc + (out.y - yc) * sc;
  out.z *= sc;
  out.x += (end === 'front' ? 1 : -1) * (end === 'front' ? NOSE_R : TAIL_R) * Math.sin(phi);
  return out;
}

// Body height at a lateral offset z for a given u (used to seat the canopy).
export function bodyHeightAt(u, z) {
  let lo = 0.5, hi = 1.0; // v range of the upper right quadrant (shoulder..centre)
  const p = new THREE.Vector3();
  const vSh = TH_B / (Math.PI + 2 * TH_B);
  lo = vSh;
  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    bodyPoint(u, mid, p);
    if (p.z > z) lo = mid; else hi = mid;
  }
  bodyPoint(u, (lo + hi) / 2, p);
  return p.y;
}

// --- wheel arches ---------------------------------------------------------
export const ARCHES = [
  { x: FRONT_AXLE, y: 0.345, r: 0.4 },
  { x: REAR_AXLE, y: 0.36, r: 0.415 },
];
function archCut(p) {
  if (Math.abs(p.z) < 0.5) return null;
  for (const a of ARCHES) {
    const dx = p.x - a.x, dy = p.y - a.y;
    if (dx * dx + dy * dy < a.r * a.r) return a;
  }
  return null;
}

// Generic parametric grid -> BufferGeometry with finite-difference normals and
// optional circular cut-outs snapped cleanly to the arch radius.
function gridGeometry({ nu, nv, param, point, cut = null, uvScale = [1, 1], centre }) {
  const pos = [], nor = [], uvs = [], inside = [];
  const p = new THREE.Vector3(), pu = new THREE.Vector3(), pv = new THREE.Vector3();
  const du = new THREE.Vector3(), dv = new THREE.Vector3(), n = new THREE.Vector3();
  const e = 1e-4;
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const [a, b] = param(i / nu, j / nv);
      point(a, b, p);
      point(a + e, b, pu); point(a - e, b, du); pu.sub(du);
      point(a, b + e, pv); point(a, b - e, dv); pv.sub(dv);
      n.crossVectors(pu, pv);
      if (n.lengthSq() < 1e-14) n.set(p.x - centre.x, p.y - centre.y, p.z);
      n.normalize();
      // keep normals facing outward from the car's centre line
      if (n.x * (p.x - centre.x) + n.y * (p.y - centre.y) + n.z * p.z < 0) n.negate();
      const arch = cut ? cut(p) : null;
      inside.push(arch);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      uvs.push(a * uvScale[0], b * uvScale[1]);
    }
  }
  const idx = [];
  const row = nu + 1;
  const used = new Uint8Array(inside.length);
  const tri = (a, b, c) => {
    if (inside[a] && inside[b] && inside[c]) return;
    // orient so the face normal agrees with the vertex normal
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const e1 = [pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az];
    const e2 = [pos[c * 3] - ax, pos[c * 3 + 1] - ay, pos[c * 3 + 2] - az];
    const fx = e1[1] * e2[2] - e1[2] * e2[1], fy = e1[2] * e2[0] - e1[0] * e2[2], fz = e1[0] * e2[1] - e1[1] * e2[0];
    const d = fx * nor[a * 3] + fy * nor[a * 3 + 1] + fz * nor[a * 3 + 2];
    if (d >= 0) idx.push(a, b, c); else idx.push(a, c, b);
    used[a] = used[b] = used[c] = 1;
  };
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      tri(a, b, d); tri(a, d, c);
    }
  }
  // snap boundary vertices that fell inside an arch onto the arch circle
  for (let k = 0; k < inside.length; k++) {
    const arch = inside[k];
    if (!arch || !used[k]) continue;
    const dx = pos[k * 3] - arch.x, dy = pos[k * 3 + 1] - arch.y;
    const l = Math.hypot(dx, dy) || 1;
    pos[k * 3] = arch.x + (dx / l) * arch.r;
    pos[k * 3 + 1] = arch.y + (dy / l) * arch.r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

const BODY_CENTRE = new THREE.Vector3(0, 0.45, 0);
const GAP_U = 0.0016, GAP_V = 0.0022; // shut-line gaps between panels

// A body panel spanning u in [u0(v), u1(v)] and v in [v0, v1].
export function bodyPanel({ u0, u1, v0, v1, density = 1, cut = true, uvScale = [LEN * 1.6, 7] }) {
  const U0 = typeof u0 === 'function' ? u0 : () => u0;
  const U1 = typeof u1 === 'function' ? u1 : () => u1;
  const span = Math.max(U1(v0) - U0(v0), U1(v1) - U0(v1), U1((v0 + v1) / 2) - U0((v0 + v1) / 2));
  const nu = Math.max(4, Math.ceil(span * 240 * density));
  const nv = Math.max(4, Math.ceil((v1 - v0) * 150 * density));
  return gridGeometry({
    nu, nv, centre: BODY_CENTRE, uvScale,
    cut: cut ? archCut : null,
    param: (s, t) => {
      const v = lerp(v0 + GAP_V, v1 - GAP_V, t);
      return [lerp(U0(v) + GAP_U, U1(v) - GAP_U, s), v];
    },
    point: (u, v, out) => bodyPoint(clamp(u, 0, 1), v, out),
  });
}

// Fascia: a thin band of the loft plus the rounded cap.
export function capPanel(end, uBand, density = 1) {
  const front = end === 'front';
  const nk = Math.ceil(14 * density), nb = Math.ceil(uBand * 240 * density) + 2;
  return gridGeometry({
    nu: nk + nb, nv: Math.ceil(150 * density),
    centre: new THREE.Vector3(front ? X_FRONT - 0.4 : X_REAR + 0.4, 0.45, 0),
    uvScale: [1, 1],
    param: (s, t) => [s * (nk + nb), lerp(GAP_V, 1 - GAP_V, t)],
    point: (s, v, out) => {
      if (s <= nk) return capPoint(end, 1 - s / nk, v, out);
      const f = (s - nk) / nb;
      const u = front ? f * (uBand - GAP_U) : 1 - f * (uBand - GAP_U);
      return bodyPoint(u, v, out);
    },
  });
}

// Surface frame helper for mounting details onto the body.
export function surfaceFrame(u, v) {
  const p = bodyPoint(u, v);
  const a = bodyPoint(u + 1e-3, v).sub(bodyPoint(u - 1e-3, v));
  const b = bodyPoint(u, v + 1e-3).sub(bodyPoint(u, v - 1e-3));
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  if (n.dot(p.clone().sub(BODY_CENTRE)) < 0) n.negate();
  return { p, n };
}
export function capFrame(end, k, v) {
  const p = capPoint(end, k, v, new THREE.Vector3());
  const a = capPoint(end, Math.min(1, k + 1e-3), v, new THREE.Vector3()).sub(capPoint(end, Math.max(0, k - 1e-3), v, new THREE.Vector3()));
  const b = capPoint(end, k, v + 1e-3, new THREE.Vector3()).sub(capPoint(end, k, v - 1e-3, new THREE.Vector3()));
  const n = new THREE.Vector3().crossVectors(a, b).normalize();
  const c = new THREE.Vector3(end === 'front' ? X_FRONT - 0.4 : X_REAR + 0.4, 0.45, 0);
  if (n.dot(p.clone().sub(c)) < 0) n.negate();
  return { p, n };
}

// --- canopy (glasshouse) ---------------------------------------------------
export const CU0 = 0.27, CU1 = 0.71;
const CAN_W = curve([[CU0, 0.5], [0.32, 0.63], [0.42, 0.67], [0.53, 0.67], [0.63, 0.6], [CU1, 0.38]]);
const CAN_H = curve([[CU0, 0], [0.31, 0.1], [0.37, 0.22], [0.44, 0.31], [0.53, 0.325], [0.6, 0.26], [0.66, 0.14], [CU1, 0]]);
const baseCache = new Map();
function canopyBase(u) {
  const key = Math.round(u * 20000);
  if (!baseCache.has(key)) baseCache.set(key, bodyHeightAt(u, CAN_W(u)) - 0.012);
  return baseCache.get(key);
}
export function canopyPoint(u, w, out = new THREE.Vector3()) {
  const b = w * Math.PI;
  const c = Math.cos(b), s = Math.sin(b);
  out.set(xAtU(u), canopyBase(u) + CAN_H(u) * Math.pow(s, 2 / 2.6), CAN_W(u) * Math.sign(c) * Math.pow(Math.abs(c), 2 / 3.6));
  return out;
}
export function canopyPanel(u0, u1, w0, w1, density = 1) {
  const nu = Math.max(4, Math.ceil((u1 - u0) * 220 * density));
  const nv = Math.max(4, Math.ceil((w1 - w0) * 60 * density));
  return gridGeometry({
    nu, nv, centre: new THREE.Vector3(0, 0.7, 0), uvScale: [LEN * 1.6, 4],
    param: (s, t) => [lerp(u0 + 0.001, u1 - 0.001, s), lerp(w0 + 0.002, w1 - 0.002, t)],
    point: (u, w, out) => canopyPoint(clamp(u, CU0, CU1), clamp(w, 0, 1), out),
  });
}

// The signature C-shaped division on each flank (u as a function of v on the
// right side; mirrored for the left).
export const C_TOP_V = 0.35;
export function cLineU(v) {
  const t = clamp(v / C_TOP_V);
  return 0.54 + 0.085 * Math.sin(Math.PI * Math.pow(t, 0.85)) - 0.025 * (1 - t);
}
