import * as THREE from 'three';
import * as T from './textures.js';

// Physically based material library for the car and studio.
export function createMaterials() {
  const carbonMap = T.carbonTexture();
  const carbonFine = carbonMap.clone();
  carbonFine.repeat.set(6, 6);
  carbonFine.needsUpdate = true;
  const honey = T.honeycombTexture();
  const leatherN = T.grainNormal(256, 3.0);
  leatherN.repeat.set(3, 3);
  const castN = T.grainNormal(128, 1.2);
  castN.repeat.set(4, 4);
  const fin = T.finTexture();

  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);

  const M = {
    paint: phys({
      color: 0x0a2363, metalness: 0.62, roughness: 0.3,
      clearcoat: 1, clearcoatRoughness: 0.035, envMapIntensity: 1.25,
    }),
    carbon: phys({
      map: carbonMap, color: 0xb0b6c4, metalness: 0.25, roughness: 0.38,
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1,
    }),
    carbonFine: phys({
      map: carbonFine, color: 0xb0b6c4, metalness: 0.25, roughness: 0.4,
      clearcoat: 0.8, clearcoatRoughness: 0.08,
    }),
    carbonMatte: std({ map: carbonFine, color: 0x9da3b0, metalness: 0.2, roughness: 0.55 }),
    glass: phys({
      color: 0x070b14, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.74,
      envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide,
    }),
    chrome: std({ color: 0xe8e8ea, metalness: 1, roughness: 0.07 }),
    aluminium: std({ color: 0xb9bdc4, metalness: 1, roughness: 0.28 }),
    cast: std({ color: 0x8d9097, metalness: 1, roughness: 0.5, normalMap: castN, normalScale: new THREE.Vector2(0.4, 0.4) }),
    titanium: phys({
      color: 0xa79f92, metalness: 1, roughness: 0.27,
      iridescence: 0.35, iridescenceIOR: 1.5, iridescenceThicknessRange: [260, 420],
    }),
    champagne: std({ color: 0xcdb68a, metalness: 1, roughness: 0.22 }),
    bronze: std({ color: 0x8c5a33, metalness: 1, roughness: 0.32 }),
    darkMetal: std({ color: 0x2b2d31, metalness: 0.9, roughness: 0.42 }),
    gunmetal: std({ color: 0x3d4046, metalness: 1, roughness: 0.25 }),
    black: std({ color: 0x0a0a0b, metalness: 0.1, roughness: 0.62 }),
    gloss: phys({ color: 0x050506, metalness: 0.1, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 }),
    rubber: std({ color: 0x111112, metalness: 0, roughness: 0.88 }),
    grille: std({ map: honey, color: 0xffffff, metalness: 0.6, roughness: 0.45 }),
    liner: std({ color: 0x040404, metalness: 0, roughness: 0.9, envMapIntensity: 0.15, side: THREE.DoubleSide }),
    radiator: std({ map: fin, color: 0xffffff, metalness: 0.8, roughness: 0.45 }),
    lens: phys({ color: 0xffffff, emissive: 0xdfe9ff, emissiveIntensity: 2.4, metalness: 0, roughness: 0.05 }),
    led: std({ color: 0xffffff, emissive: 0xeaf1ff, emissiveIntensity: 3.2 }),
    tail: std({ color: 0x400000, emissive: 0xff1a12, emissiveIntensity: 3.0 }),
    enamel: phys({ color: 0xa3101a, roughness: 0.12, clearcoat: 1 }),
    disc: std({ map: T.discTexture(), metalness: 0.65, roughness: 0.42 }),
    leather: phys({
      map: T.leatherTexture('#6c3a1d', '#e0c9a0'), normalMap: leatherN, normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.58, metalness: 0, sheen: 0.4, sheenColor: new THREE.Color(0x8a5a3a), sheenRoughness: 0.6,
    }),
    leatherPlain: phys({
      color: 0x6c3a1d, normalMap: leatherN, normalScale: new THREE.Vector2(0.35, 0.35),
      roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color(0x8a5a3a),
    }),
    leatherDark: phys({
      color: 0x16130f, normalMap: leatherN, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.62, sheen: 0.3,
    }),
    gauge: std({ map: T.gaugeTexture(), emissive: 0xffffff, emissiveMap: T.gaugeTexture(), emissiveIntensity: 0.9, roughness: 0.3 }),
    mount: std({ color: 0xd8b878, metalness: 1, roughness: 0.25, emissive: 0x3a2a10, emissiveIntensity: 0.4 }),
  };
  return M;
}

// Highlight support: each mesh keeps its base material, and a lazily created
// emissive clone is swapped in while a component is being discussed.
const HL_COLOR = new THREE.Color(0xd9b67a);
export function setHighlight(mesh, amount) {
  const base = mesh.userData.baseMat || (mesh.userData.baseMat = mesh.material);
  if (amount < 0.01) {
    if (mesh.material !== base) mesh.material = base;
    return;
  }
  if (!mesh.userData.hlMat) {
    const make = (b) => {
      const hl = b.clone();
      if (hl.emissive) {
        hl.userData.baseEmissive = hl.emissive.clone();
        hl.userData.baseEI = hl.emissiveIntensity ?? 1;
      }
      return hl;
    };
    mesh.userData.hlMat = Array.isArray(base) ? base.map(make) : make(base);
  }
  const hl = mesh.userData.hlMat;
  for (const h of Array.isArray(hl) ? hl : [hl]) {
    if (!h.emissive) continue;
    h.emissive.copy(h.userData.baseEmissive).lerp(HL_COLOR, Math.min(1, amount));
    h.emissiveIntensity = Math.max(h.userData.baseEI * (1 - amount), 0.035 * amount);
  }
  mesh.material = hl;
}
