import * as THREE from 'three';
import * as B from './body.js';
import { DEG } from './util.js';

// ---------------------------------------------------------------------------
// The car is built as a registry of separate components. Each component is a
// Group whose transform at build time is its assembled reference state; the
// timeline only ever interpolates away from, and back to, that state.
// ---------------------------------------------------------------------------
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildCar(M, quality = 1) {
  const root = new THREE.Group();
  root.name = 'car';
  const parts = [];
  const byKey = {};

  function part(key, opts) {
    const g = new THREE.Group();
    g.name = key;
    const p = {
      key, group: g, label: opts.label || key, tags: opts.tags || [],
      stage: opts.stage ?? 1, order: opts.order ?? opts.stage ?? 1,
      offset: opts.offset || V(0, 0, 0), rot: opts.rot || new THREE.Euler(),
      lift: opts.lift ?? 0.15, sub: opts.sub || {},
    };
    parts.push(p);
    byKey[key] = p;
    root.add(g);
    return p;
  }
  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };
  const add = (p, geo, mat, pos, rot, scl) => {
    const m = mesh(geo, mat);
    if (pos) m.position.copy(pos);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2], rot[3] || 'XYZ');
    if (scl) m.scale.copy(scl);
    p.group.add(m);
    return m;
  };
  // cylinder between two points
  const rod = (p, a, b, r, mat, seg = 12) => {
    const d = b.clone().sub(a);
    const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
    p.group.add(m);
    return m;
  };
  const rbox = (w, h, d, r = 0.02, seg = 3) => roundedBox(w, h, d, r, seg);
  const D = quality;

  // ======================= BODY PANELS ====================================
  const SIDES = [1, -1];
  const mirrorV = (s, v) => (s > 0 ? v : 1 - v);
  const sideName = (s) => (s > 0 ? 'R' : 'L');

  {
    const p = part('frontFascia', { label: 'Front fascia', tags: ['body', 'exterior'], stage: 1, order: 10, offset: V(1.55, 0.22, 0) });
    add(p, B.capPanel('front', 0.035, D), M.paint);
  }
  {
    const p = part('rearFascia', { label: 'Rear fascia', tags: ['body', 'exterior'], stage: 1, order: 10, offset: V(-1.6, 0.3, 0) });
    add(p, B.capPanel('rear', 0.035, D), M.paint);
  }
  {
    const p = part('hood', { label: 'Front bonnet', tags: ['body', 'exterior'], stage: 2, order: 12, offset: V(0.45, 1.75, 0), rot: new THREE.Euler(0, 0, 0.1), lift: 0 });
    add(p, B.bodyPanel({ u0: 0.035, u1: 0.3, v0: 0.355, v1: 0.645, density: D }), M.paint);
  }
  {
    const p = part('engineCover', { label: 'Engine cover', tags: ['body', 'exterior'], stage: 2, order: 12, offset: V(-0.55, 2.0, 0), rot: new THREE.Euler(0, 0, -0.08), lift: 0 });
    add(p, B.bodyPanel({ u0: 0.6, u1: 0.965, v0: 0.355, v1: 0.645, density: D, uvScale: [B.LEN * 1.6, 7] }), M.paint);
    // carbon centre fin
    const finShape = new THREE.Shape();
    finShape.moveTo(-1.95, 0); finShape.quadraticCurveTo(-1.2, 0.07, -0.55, 0.0); finShape.lineTo(-1.95, 0);
    const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.012, bevelEnabled: false });
    fin.translate(0, 0, -0.006);
    const f = add(p, fin, M.carbon);
    f.position.y = 0.975;
    // conform fin base to the deck
    const pos = fin.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const yb = B.bodyPoint(B.uAtX(x), 0.5).y - 0.975 - 0.01;
      pos.setY(i, pos.getY(i) + yb);
    }
    fin.computeVertexNormals();
  }
  {
    const p = part('canopy', { label: 'Glasshouse', tags: ['body', 'glass'], stage: 2, order: 11, offset: V(0, 2.35, 0), lift: 0 });
    add(p, B.canopyPanel(B.CU0, 0.45, 0, 1, D), M.glass);
    add(p, B.canopyPanel(0.45, 0.6, 0.27, 0.73, D), M.carbon);
    add(p, B.canopyPanel(0.45, 0.6, 0, 0.27, D), M.glass);
    add(p, B.canopyPanel(0.45, 0.6, 0.73, 1, D), M.glass);
    add(p, B.canopyPanel(0.6, B.CU1, 0, 1, D), M.glass);
    // window frames: thin dark strips along the glass edges
    for (const s of SIDES) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const u = B.CU0 + (B.CU1 - B.CU0) * (i / 40);
        pts.push(B.canopyPoint(u, s > 0 ? 0.03 : 0.97).add(V(0, 0.004, 0)));
      }
      add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.012, 6), M.chrome);
    }
  }
  for (const s of SIDES) {
    const sn = sideName(s);
    {
      const p = part('fender' + sn, { label: 'Front wing', tags: ['body', 'exterior'], stage: 2, order: 11, offset: V(0.35, 0.95, 1.05 * s), rot: new THREE.Euler(0.12 * s, 0, 0) });
      add(p, B.bodyPanel(s > 0 ? { u0: 0.035, u1: 0.335, v0: 0, v1: 0.355, density: D } : { u0: 0.035, u1: 0.335, v0: 0.645, v1: 1, density: D }), M.paint);
      add(p, archLiner(B.ARCHES[0], s), M.liner);
    }
    {
      const p = part('door' + sn, { label: 'Door', tags: ['body', 'exterior'], stage: 3, order: 13, offset: V(0, 0.42, 1.6 * s), rot: new THREE.Euler(0, -0.12 * s, 0) });
      const cu = (v) => B.cLineU(s > 0 ? v : 1 - v);
      add(p, B.bodyPanel(s > 0 ? { u0: 0.335, u1: cu, v0: 0, v1: 0.355, density: D } : { u0: 0.335, u1: cu, v0: 0.645, v1: 1, density: D }), M.paint);
      // mirror
      const fr = B.surfaceFrame(0.36, mirrorV(s, 0.33));
      const head = add(p, new THREE.SphereGeometry(0.075, 24, 16), M.paint, fr.p.clone().add(V(-0.02, 0.07, 0.13 * s)), null, V(1.3, 0.62, 0.9));
      head.castShadow = true;
      rod(p, fr.p.clone().add(V(0.0, 0.0, -0.01 * s)), head.position.clone().add(V(0, -0.02, -0.03 * s)), 0.012, M.carbon);
      // C-line trim
      const pts = [];
      for (let i = 0; i <= 50; i++) {
        const v = (i / 50) * B.C_TOP_V;
        const f = B.surfaceFrame(B.cLineU(v), mirrorV(s, v));
        pts.push(f.p.addScaledVector(f.n, 0.008));
      }
      add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.011, 8), M.chrome);
    }
    {
      const p = part('sideIntake' + sn, { label: 'Carbon side section', tags: ['body', 'exterior', 'carbon'], stage: 3, order: 13, offset: V(-0.15, 0.55, 1.35 * s) });
      const cu = (v) => B.cLineU(s > 0 ? v : 1 - v);
      add(p, B.bodyPanel(s > 0 ? { u0: cu, u1: 0.66, v0: 0, v1: 0.355, density: D, uvScale: [B.LEN * 2.5, 11] } : { u0: cu, u1: 0.66, v0: 0.645, v1: 1, density: D, uvScale: [B.LEN * 2.5, 11] }), M.carbon);
      // intake mouth: honeycomb patch just proud of the carbon
      const mouth = B.bodyPanel(s > 0
        ? { u0: (v) => B.cLineU(v) + 0.012, u1: (v) => B.cLineU(v) + 0.05, v0: 0.2, v1: 0.33, density: D, cut: false, uvScale: [40, 18] }
        : { u0: (v) => B.cLineU(1 - v) + 0.012, u1: (v) => B.cLineU(1 - v) + 0.05, v0: 0.67, v1: 0.8, density: D, cut: false, uvScale: [40, 18] });
      offsetAlongNormals(mouth, 0.003);
      add(p, mouth, M.grille);
    }
    {
      const p = part('quarter' + sn, { label: 'Rear haunch', tags: ['body', 'exterior'], stage: 2, order: 11, offset: V(-0.4, 0.95, 1.1 * s), rot: new THREE.Euler(0.1 * s, 0, 0) });
      add(p, B.bodyPanel(s > 0 ? { u0: 0.66, u1: 0.965, v0: 0, v1: 0.355, density: D } : { u0: 0.66, u1: 0.965, v0: 0.645, v1: 1, density: D }), M.paint);
      add(p, archLiner(B.ARCHES[1], s), M.liner);
    }
    {
      // side skirt (carbon blade along the sill)
      const p = part('skirt' + sn, { label: 'Side skirt', tags: ['aero', 'exterior', 'carbon'], stage: 3, order: 15, offset: V(0, 0.05, 1.95 * s), lift: 0.05 });
      const pts = [];
      for (let i = 0; i <= 30; i++) {
        const x = 0.92 - (1.85 * i) / 30;
        const f = B.bodyPoint(B.uAtX(x), mirrorV(s, 0.0));
        pts.push(V(x, 0.115, f.z + 0.02 * s));
      }
      const shape = new THREE.Shape();
      shape.moveTo(0, -0.025); shape.lineTo(0.07 * s, -0.035); shape.lineTo(0.075 * s, -0.012); shape.lineTo(0, 0.035);
      add(p, new THREE.ExtrudeGeometry(shape, { steps: 60, bevelEnabled: false, extrudePath: new THREE.CatmullRomCurve3(pts) }), M.carbon);
    }
  }

  // --- aero ---------------------------------------------------------------
  {
    const p = part('splitter', { label: 'Front splitter', tags: ['aero', 'exterior', 'carbon'], stage: 3, order: 15, offset: V(2.35, 0.02, 0), lift: 0.05 });
    const sh = new THREE.Shape();
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const v = 0.02 + (i / N) * 0.96;
      const f = B.bodyPoint(0.0, v);
      const k = Math.sin((i / N) * Math.PI);
      const x = B.X_FRONT + 0.35 * B_noseX(v) + 0.012 * k;
      i ? sh.lineTo(x, f.z * 1.05) : sh.moveTo(x, f.z * 1.05);
    }
    sh.lineTo(1.75, -0.9); sh.lineTo(1.75, 0.9);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
    g.rotateX(Math.PI / 2);
    g.translate(0, 0.125, 0);
    add(p, g, M.carbonMatte);
  }
  {
    const p = part('diffuser', { label: 'Rear diffuser', tags: ['aero', 'exterior', 'carbon'], stage: 3, order: 15, offset: V(-2.35, 0.06, 0), lift: 0.05 });
    const plate = rbox(0.75, 0.025, 1.6, 0.01);
    add(p, plate, M.carbon, V(-2.0, 0.16, 0), [0, 0, -0.18]);
    for (let i = -3; i <= 3; i++) {
      const fin = new THREE.Shape();
      fin.moveTo(0, 0); fin.lineTo(-0.58, 0); fin.lineTo(-0.58, 0.13); fin.lineTo(0, 0.03); fin.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(fin, { depth: 0.012, bevelEnabled: false });
      g.translate(0, 0, -0.006);
      add(p, g, M.carbon, V(-1.68, 0.1, i * 0.2));
    }
  }
  {
    const p = part('rearWing', { label: 'Active rear wing', tags: ['aero', 'exterior', 'carbon'], stage: 3, order: 15, offset: V(-0.9, 2.15, 0), rot: new THREE.Euler(0, 0, -0.06), lift: 0 });
    const foil = new THREE.Shape();
    const c = 0.42;
    foil.moveTo(0, 0);
    for (let i = 0; i <= 20; i++) { const t = i / 20; foil.lineTo(-t * c, 0.035 * Math.sin(Math.PI * Math.pow(t, 0.6))); }
    for (let i = 20; i >= 0; i--) { const t = i / 20; foil.lineTo(-t * c, -0.01 * Math.sin(Math.PI * t)); }
    const g = new THREE.ExtrudeGeometry(foil, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3 });
    g.translate(0, 0, -0.81);
    add(p, g, M.carbon, V(-1.6, 1.07, 0), [0, 0, -0.08]);
    for (const s of SIDES) {
      add(p, rbox(0.2, 0.09, 0.02, 0.006), M.gunmetal, V(-1.78, 1.02, 0.42 * s));
      add(p, rbox(0.3, 0.012, 0.012, 0.004), M.champagne, V(-1.82, 1.085, 0.81 * s));
    }
  }

  // --- lights, grille -------------------------------------------------------
  {
    const p = part('grille', { label: 'Horseshoe grille', tags: ['lights', 'exterior', 'detail'], stage: 12, order: 14, offset: V(2.35, 0.32, 0), lift: 0.1 });
    const outer = horseshoe(0.2, 0.27);
    const inner = horseshoe(0.178, 0.245);
    const frame = new THREE.Shape(outer.getPoints(64));
    frame.holes.push(new THREE.Path(inner.getPoints(64).reverse()));
    const fg = new THREE.ExtrudeGeometry(frame, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 4, curveSegments: 48 });
    fg.rotateY(Math.PI / 2);
    const gx = B.X_FRONT + B_noseX(0.5) - 0.045;
    add(p, fg, M.chrome, V(gx, 0.35, 0));
    const ig = new THREE.ShapeGeometry(new THREE.Shape(inner.getPoints(64)));
    ig.rotateY(Math.PI / 2);
    const uv = ig.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
    add(p, ig, M.grille, V(gx + 0.012, 0.35, 0));
    // enamel oval
    add(p, new THREE.SphereGeometry(0.03, 24, 12), M.enamel, V(gx + 0.045, 0.53, 0), null, V(0.3, 0.55, 1));
    // lower intakes either side of the horseshoe
    for (const s of SIDES) {
      const f = B.capFrame('front', 0.55, mirrorV(s, 0.14));
      const intake = new THREE.Mesh(intakeGeometry(), M.grille);
      intake.position.copy(f.p).addScaledVector(f.n, 0.004);
      intake.lookAt(intake.position.clone().add(f.n));
      intake.rotateZ(-0.25 * s);
      intake.castShadow = false;
      p.group.add(intake);
    }
  }
  for (const s of SIDES) {
    const p = part('headlight' + sideName(s), { label: 'Quad LED headlight', tags: ['lights', 'exterior', 'detail'], stage: 12, order: 14, offset: V(1.95, 0.55, 0.35 * s), lift: 0.1 });
    const f = B.capFrame('front', 0.3, mirrorV(s, 0.3));
    const housing = add(p, new THREE.CapsuleGeometry(0.045, 0.26, 6, 16), M.gloss, f.p.clone().addScaledVector(f.n, -0.01));
    housing.scale.set(1, 1, 0.55);
    housing.lookAt(housing.position.clone().add(f.n));
    housing.rotateZ(Math.PI / 2 - 0.3 * s);
    for (let i = 0; i < 4; i++) {
      const lens = add(p, new THREE.SphereGeometry(0.022, 16, 12), M.lens);
      lens.position.set(0, (i - 1.5) * 0.068, 0.018);
      housing.add(lens);
      lens.scale.set(1, 1, 1.4);
    }
    // LED signature strip
    const strip = add(p, new THREE.CapsuleGeometry(0.005, 0.3, 4, 8), M.led);
    strip.position.set(0.032, 0, 0.012);
    housing.add(strip);
  }
  {
    const p = part('taillight', { label: 'LED light blade', tags: ['lights', 'exterior', 'detail'], stage: 12, order: 14, offset: V(-1.95, 0.55, 0), lift: 0.1 });
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const v = 0.08 + (i / 40) * 0.84;
      const f = B.capFrame('rear', 0.3, v);
      pts.push(f.p.addScaledVector(f.n, 0.004));
    }
    // keep the strip on a single, level line
    const yL = pts[20].y;
    pts.forEach((q) => { q.y = yL; });
    add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.011, 8), M.tail);
    // full-width rear mesh beneath the light blade, with the central exhaust bezel
    const rs = new THREE.Shape();
    rs.moveTo(-0.62, 0.0); rs.lineTo(0.62, 0.0); rs.quadraticCurveTo(0.7, 0.0, 0.66, 0.1);
    rs.lineTo(0.56, 0.26); rs.lineTo(-0.56, 0.26); rs.lineTo(-0.66, 0.1); rs.quadraticCurveTo(-0.7, 0.0, -0.62, 0.0);
    const rg = new THREE.ShapeGeometry(rs, 12);
    const ruv = rg.attributes.uv;
    for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) * 5, ruv.getY(i) * 5);
    rg.rotateY(-Math.PI / 2);
    add(p, rg, M.grille, V(B.X_REAR - 0.064, 0.3, 0));
    add(p, new THREE.TorusGeometry(0.1, 0.02, 12, 40), M.titanium, V(B.X_REAR - 0.075, 0.4, 0), [0, Math.PI / 2, 0], V(1.6, 1, 1));
  }

  // ======================= MECHANICAL =====================================
  buildCorners();
  buildEngine();
  buildDrivetrain();
  buildExhaust();
  buildCooling();
  buildStructure();
  buildInterior();

  // ---- wheels, brakes, suspension ----------------------------------------
  function buildCorners() {
    const corners = [
      { id: 'FR', x: B.FRONT_AXLE, z: 0.865, r: 0.34, w: 0.285, front: true, s: 1 },
      { id: 'FL', x: B.FRONT_AXLE, z: -0.865, r: 0.34, w: 0.285, front: true, s: -1 },
      { id: 'RR', x: B.REAR_AXLE, z: 0.835, r: 0.355, w: 0.355, front: false, s: 1 },
      { id: 'RL', x: B.REAR_AXLE, z: -0.835, r: 0.355, w: 0.355, front: false, s: -1 },
    ];
    for (const c of corners) {
      const s = c.s, cy = c.r, C = V(c.x, cy, c.z);
      const rimR = c.front ? 0.254 : 0.267;
      const tag = ['corner', 'corner-' + c.id];
      const FL = c.id === 'FL';
      // tyre
      {
        const p = part(c.id + '.tire', { label: 'Performance tyre', tags: [...tag, 'wheel'], stage: 4, order: 8, offset: V(0, 0, 1.65 * s), lift: 0.12, sub: FL ? { wheel: V(0, 0, -1.3) } : {} });
        add(p, tireGeometry(c.r, rimR, c.w), M.rubber, C, [Math.PI / 2, 0, 0]);
      }
      // rim
      {
        const p = part(c.id + '.rim', { label: 'Forged alloy wheel', tags: [...tag, 'wheel'], stage: 4, order: 8, offset: V(0, 0, 1.65 * s), lift: 0.12, sub: FL ? { wheel: V(0, 0, -0.98) } : {} });
        const g = new THREE.Group();
        g.position.copy(C);
        g.rotation.y = s > 0 ? 0 : Math.PI;
        p.group.add(g);
        buildRim(g, rimR, c.w);
      }
      // brake disc
      const discR = c.front ? 0.21 : 0.2;
      const zIn = c.z - s * (c.w * 0.5 - 0.06);
      {
        const p = part(c.id + '.disc', { label: 'Carbon-ceramic disc', tags: [...tag, 'brake'], stage: 5, order: 7, offset: V(0, 0, 1.08 * s), lift: 0.1, sub: FL ? { wheel: V(0, 0.0, -0.5) } : {} });
        const d = add(p, new THREE.CylinderGeometry(discR, discR, 0.036, 64, 1), [M.darkMetal, M.disc, M.disc], V(c.x, cy, zIn), [Math.PI / 2, 0, 0]);
        d.material = [M.darkMetal, M.disc, M.disc];
        add(p, new THREE.CylinderGeometry(0.11, 0.12, 0.07, 32), M.aluminium, V(c.x, cy, zIn + 0.035 * s), [Math.PI / 2, 0, 0]);
      }
      // caliper (trailing edge, upper)
      {
        const p = part(c.id + '.caliper', { label: 'Monobloc caliper', tags: [...tag, 'brake'], stage: 5, order: 7, offset: V(0, 0.05, 1.08 * s), lift: 0.1, sub: FL ? { wheel: V(0, 0.18, -0.7) } : {} });
        const sh = new THREE.Shape();
        const a0 = 20 * DEG, a1 = 95 * DEG, r0 = discR - 0.07, r1 = discR + 0.035;
        sh.absarc(0, 0, r1, a0, a1, false);
        sh.absarc(0, 0, r0, a1, a0, true);
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 4, curveSegments: 24 });
        g.translate(0, 0, -0.05);
        const m = add(p, g, M.bronze, V(c.x, cy, zIn));
        // rotate the arc to sit behind the axle (toward the car centre)
        m.rotation.z = c.front ? Math.PI * 0.55 : Math.PI * 0.45;
        if (!c.front) m.rotation.y = Math.PI;
      }
      // upright / hub carrier
      {
        const p = part(c.id + '.upright', { label: 'Upright & hub', tags: [...tag, 'suspension'], stage: 6, order: 6, offset: V(0, 0.12, 0.58 * s), sub: FL ? { wheel: V(0, 0, -0.22) } : {} });
        const zu = c.z - s * (c.w * 0.5 + 0.03);
        add(p, rbox(0.11, 0.36, 0.07, 0.025), M.cast, V(c.x, cy + 0.02, zu));
        add(p, new THREE.CylinderGeometry(0.06, 0.06, 0.12, 24), M.aluminium, V(c.x, cy, zu + 0.05 * s), [Math.PI / 2, 0, 0]);
      }
      // wishbones
      const zu = c.z - s * (c.w * 0.5 + 0.03);
      const inner = 0.4 * s;
      {
        const p = part(c.id + '.arms', { label: 'Double wishbones', tags: [...tag, 'suspension'], stage: 6, order: 6, offset: V(0, 0.2, 0.45 * s), sub: FL ? { wheel: V(0, 0.0, 0.0) } : {} });
        const up = V(c.x, cy + 0.17, zu), lo = V(c.x, cy - 0.15, zu);
        for (const [tip, dy] of [[up, 0.17], [lo, -0.15]]) {
          rod(p, tip, V(c.x + 0.2, cy + dy, inner), 0.016, M.darkMetal);
          rod(p, tip, V(c.x - 0.2, cy + dy, inner), 0.016, M.darkMetal);
          add(p, new THREE.SphereGeometry(0.028, 12, 8), M.aluminium, tip);
        }
      }
      // spring & damper
      {
        const p = part(c.id + '.damper', { label: 'Spring & damper', tags: [...tag, 'suspension'], stage: 6, order: 6, offset: V(0, 0.42, 0.38 * s), sub: FL ? { wheel: V(0, 0.32, 0.12) } : {} });
        const a = V(c.x - 0.04, cy - 0.12, c.z - s * (c.w * 0.5 + 0.12));
        const b = V(c.x - 0.04, cy + 0.4, inner + 0.07 * s);
        rod(p, a, a.clone().lerp(b, 0.62), 0.024, M.gunmetal);
        rod(p, a.clone().lerp(b, 0.55), b, 0.014, M.chrome);
        const dir = b.clone().sub(a);
        const coil = add(p, new THREE.TubeGeometry(new HelixCurve(0.05, dir.length() * 0.62, 7), 220, 0.008, 6), M.champagne, a.clone().addScaledVector(dir, 0.18));
        coil.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
      }
      if (c.front) {
        const p = part(c.id + '.steer', { label: 'Steering track rod', tags: [...tag, 'suspension', 'steering'], stage: 6, order: 6, offset: V(0.15, 0.1, 0.3 * s), sub: FL ? { wheel: V(0.18, -0.02, 0.05) } : {} });
        rod(p, V(c.x - 0.12, cy - 0.05, zu - 0.02 * s), V(c.x - 0.14, cy - 0.06, 0.22 * s), 0.011, M.aluminium);
        add(p, new THREE.SphereGeometry(0.02, 10, 8), M.aluminium, V(c.x - 0.12, cy - 0.05, zu - 0.02 * s));
      }
    }
  }

  function buildRim(g, rimR, width) {
    // barrel
    const prof = [
      [rimR - 0.012, -width * 0.5], [rimR, -width * 0.5 + 0.004], [rimR - 0.01, -width * 0.45],
      [rimR - 0.03, -width * 0.2], [rimR - 0.035, width * 0.25], [rimR - 0.012, width * 0.44],
      [rimR + 0.004, width * 0.5 - 0.004], [rimR - 0.004, width * 0.5 + 0.006], [rimR - 0.02, width * 0.5],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const barrel = new THREE.LatheGeometry(prof, 72);
    barrel.rotateX(Math.PI / 2);
    const b = mesh(barrel, M.gunmetal);
    b.material = M.gunmetal;
    g.add(b);
    const lip = mesh(new THREE.TorusGeometry(rimR - 0.006, 0.006, 8, 96), M.chrome);
    lip.position.z = width * 0.5 + 0.002;
    g.add(lip);
    // ten twin-blade spokes, slightly dished
    const n = 10;
    for (let i = 0; i < n; i++) {
      const sh = new THREE.Shape();
      sh.moveTo(0.06, -0.022); sh.lineTo(rimR - 0.03, -0.012); sh.lineTo(rimR - 0.012, -0.006);
      sh.lineTo(rimR - 0.012, 0.006); sh.lineTo(rimR - 0.03, 0.012); sh.lineTo(0.06, 0.022);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2 });
      // dish: push the outer end inward
      const pos = geo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const x = pos.getX(k);
        pos.setZ(k, pos.getZ(k) - (x / rimR) * 0.06);
      }
      geo.computeVertexNormals();
      const m = mesh(geo, i % 2 ? M.aluminium : M.gunmetal);
      m.material = M.aluminium;
      m.rotation.z = (i / n) * Math.PI * 2;
      m.position.z = width * 0.5 - 0.02;
      g.add(m);
      const m2 = m.clone();
      m2.rotation.z += 0.12;
      m2.material = M.gunmetal;
      g.add(m2);
    }
    const hub = mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.06, 40), M.gunmetal);
    hub.rotation.x = Math.PI / 2;
    hub.position.z = width * 0.5 + 0.0;
    g.add(hub);
    const cap = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 32), M.enamel);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = width * 0.5 + 0.034;
    g.add(cap);
    for (let i = 0; i < 1; i++) {
      const nut = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 6), M.chrome);
      nut.rotation.x = Math.PI / 2;
      nut.position.z = width * 0.5 + 0.026;
      g.add(nut);
    }
  }

  // ---- engine (representative W16) ----------------------------------------
  function buildEngine() {
    const EX = -0.88, EY = 0.42;
    const tag = ['engine'];
    const up = V(0, 0.82, 0);
    {
      const p = part('engine.block', { label: 'W16 engine block', tags: [...tag, 'engine-core'], stage: 8, order: 4, offset: up.clone(), lift: 0 });
      add(p, rbox(0.74, 0.3, 0.5, 0.05), M.cast, V(EX, EY - 0.08, 0));
      add(p, rbox(0.7, 0.08, 0.42, 0.03), M.darkMetal, V(EX, EY - 0.26, 0)); // sump
      // front timing cover & pulleys
      add(p, rbox(0.05, 0.36, 0.46, 0.03), M.darkMetal, V(EX + 0.39, EY - 0.04, 0));
      const pulley = add(p, new THREE.CylinderGeometry(0.075, 0.075, 0.03, 40), M.aluminium, V(EX + 0.43, EY - 0.12, 0), [0, 0, Math.PI / 2]);
      pulley.userData.spin = 'crank';
      add(p, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 30), M.aluminium, V(EX + 0.43, EY + 0.1, 0.13), [0, 0, Math.PI / 2]);
      add(p, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 30), M.aluminium, V(EX + 0.43, EY + 0.1, -0.13), [0, 0, Math.PI / 2]);
      // two cylinder banks in a 90° V; each bank holds two staggered rows of four
      for (const s of SIDES) {
        const bank = new THREE.Group();
        bank.position.set(EX, EY + 0.06, 0.09 * s);
        bank.rotation.x = s * 45 * DEG;
        p.group.add(bank);
        const blk = mesh(rbox(0.72, 0.22, 0.25, 0.02), M.cast);
        blk.position.y = 0.11;
        bank.add(blk);
        // dark bores on the deck face
        for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
          const bore = mesh(new THREE.RingGeometry(0.046, 0.058, 32), M.black, false);
          bore.rotation.x = -Math.PI / 2;
          bore.position.set(-0.24 + i * 0.16 + (r ? 0.08 : 0) - 0.04, 0.2215, (r ? 0.055 : -0.055));
          bank.add(bore);
        }
      }
    }
    // pistons: representative motion inside the bores (visible with the heads lifted)
    {
      const p = part('engine.pistons', { label: 'Pistons', tags: [...tag, 'engine-core'], stage: 8, order: 4, offset: up.clone(), lift: 0 });
      const list = [];
      let k = 0;
      for (const s of SIDES) {
        const bank = new THREE.Group();
        bank.position.set(EX, EY + 0.06, 0.09 * s);
        bank.rotation.x = s * 45 * DEG;
        p.group.add(bank);
        for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
          const pis = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 28), M.chrome);
          pis.position.set(-0.24 + i * 0.16 + (r ? 0.08 : 0) - 0.04, 0.232, (r ? 0.055 : -0.055));
          pis.userData.baseY = 0.232;
          pis.userData.phase = ((k * 5) % 16) / 16 * Math.PI * 2;
          k++;
          bank.add(pis);
          list.push(pis);
        }
      }
      p.pistons = list;
    }
    // cylinder heads with ribbed carbon covers; lifted along the bank axis in the engine chapter
    for (const s of SIDES) {
      const n = V(0, Math.cos(45 * DEG), s * Math.sin(45 * DEG));
      const p = part('engine.head' + sideName(s), { label: 'Cylinder head', tags: [...tag, 'engine-head'], stage: 8, order: 4, offset: up.clone(), lift: 0, sub: { engine: n.clone().multiplyScalar(0.34) } });
      const bank = new THREE.Group();
      bank.position.set(EX, EY + 0.06, 0.09 * s);
      bank.rotation.x = s * 45 * DEG;
      p.group.add(bank);
      const head = mesh(rbox(0.74, 0.1, 0.27, 0.025), M.darkMetal);
      head.position.y = 0.28;
      bank.add(head);
      const cover = mesh(rbox(0.7, 0.06, 0.22, 0.03), M.carbon);
      cover.position.y = 0.355;
      bank.add(cover);
      for (let i = 0; i < 6; i++) {
        const rib = mesh(rbox(0.012, 0.012, 0.2, 0.004), M.champagne);
        rib.position.set(-0.25 + i * 0.1, 0.39, 0);
        bank.add(rib);
      }
    }
    // intake plenum in the valley
    {
      const p = part('engine.intake', { label: 'Intake system', tags: [...tag, 'engine-intake'], stage: 8, order: 4, offset: up.clone().add(V(0, 0.06, 0)), lift: 0, sub: { engine: V(0, 0.42, 0) } });
      add(p, rbox(0.66, 0.1, 0.16, 0.05), M.aluminium, V(EX, EY + 0.32, 0));
      for (let i = 0; i < 4; i++) {
        add(p, new THREE.CylinderGeometry(0.03, 0.03, 0.12, 16), M.aluminium, V(EX - 0.24 + i * 0.16, EY + 0.25, 0));
      }
      add(p, new THREE.CylinderGeometry(0.06, 0.06, 0.2, 24), M.carbon, V(EX - 0.42, EY + 0.33, 0), [0, 0, Math.PI / 2]);
    }
    // four turbochargers, two per side at the rear of the block
    for (const s of SIDES) {
      const p = part('engine.turbos' + sideName(s), { label: 'Turbochargers', tags: [...tag, 'engine-turbo'], stage: 8, order: 4, offset: up.clone().add(V(0, 0, 0.12 * s)), lift: 0, sub: { engine: V(-0.05, 0.05, 0.24 * s) } });
      for (let i = 0; i < 2; i++) {
        const tc = V(EX - 0.18 + i * 0.3, EY + 0.02, 0.4 * s);
        add(p, new THREE.TorusGeometry(0.065, 0.035, 14, 32, Math.PI * 1.6), M.titanium, tc, [0, 0, i * 0.5]);
        add(p, new THREE.CylinderGeometry(0.06, 0.07, 0.07, 28), M.aluminium, tc.clone().add(V(0, 0, -0.04 * s)), [Math.PI / 2, 0, 0]);
        add(p, new THREE.CylinderGeometry(0.035, 0.035, 0.08, 20), M.titanium, tc.clone().add(V(0, 0, 0.05 * s)), [Math.PI / 2, 0, 0]);
        // exhaust manifold runners from the head to the turbine
        for (let k = 0; k < 2; k++) {
          const curve = new THREE.CatmullRomCurve3([
            V(EX - 0.25 + i * 0.3 + k * 0.12, EY + 0.33, 0.3 * s),
            V(EX - 0.22 + i * 0.3 + k * 0.08, EY + 0.22, 0.4 * s),
            tc.clone().add(V(0.02, 0.06, 0)),
          ]);
          add(p, new THREE.TubeGeometry(curve, 20, 0.018, 8), M.titanium);
        }
      }
    }
  }

  // ---- transmission & drivetrain -------------------------------------------
  function buildDrivetrain() {
    const tag = ['driveline'];
    {
      const p = part('transmission', { label: '7-speed dual-clutch transmission', tags: [...tag, 'transmission'], stage: 8, order: 4, offset: V(-0.7, 0.62, 0), lift: 0, sub: { drive: V(-0.22, 0, 0) } });
      add(p, rbox(0.5, 0.3, 0.34, 0.06), M.cast, V(-1.55, 0.36, 0));
      add(p, rbox(0.12, 0.38, 0.42, 0.04), M.darkMetal, V(-1.3, 0.38, 0)); // bellhousing / clutch
      add(p, new THREE.SphereGeometry(0.15, 28, 18), M.cast, V(-1.355, 0.34, 0), null, V(1, 1, 1.25)); // rear diff
      for (let i = 0; i < 5; i++) add(p, rbox(0.012, 0.25, 0.3, 0.004), M.darkMetal, V(-1.65 + i * 0.04, 0.36, 0));
    }
    for (const s of SIDES) {
      const p = part('halfshaftR'.replace('R', sideName(s)), { label: 'Rear half-shaft', tags: [...tag, 'shaft'], stage: 6, order: 5, offset: V(0, 0.15, 0.62 * s), sub: { drive: V(0, 0, 0.1 * s) } });
      rod(p, V(-1.355, 0.345, 0.17 * s), V(-1.355, 0.355, 0.66 * s), 0.025, M.aluminium);
      for (const zz of [0.2, 0.62]) add(p, new THREE.CylinderGeometry(0.045, 0.03, 0.08, 16), M.black, V(-1.355, 0.35, zz * s), [Math.PI / 2, 0, 0]);
    }
    {
      const p = part('propshaft', { label: 'Propeller shaft', tags: [...tag, 'shaft'], stage: 6, order: 5, offset: V(0, 0.12, 0), lift: 0.1, sub: { drive: V(0, -0.04, 0) } });
      rod(p, V(-1.2, 0.17, 0), V(1.2, 0.23, 0), 0.028, M.carbonFine);
      add(p, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16), M.aluminium, V(-1.2, 0.17, 0), [0, 0, Math.PI / 2]);
      add(p, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16), M.aluminium, V(1.2, 0.23, 0), [0, 0, Math.PI / 2]);
    }
    {
      const p = part('frontDiff', { label: 'Front axle drive', tags: [...tag, 'transmission'], stage: 6, order: 5, offset: V(0.5, 0.25, 0), sub: { drive: V(0.2, 0, 0) } });
      add(p, new THREE.SphereGeometry(0.12, 24, 16), M.cast, V(1.33, 0.29, 0), null, V(1.1, 1, 1.2));
      add(p, rbox(0.12, 0.12, 0.2, 0.03), M.darkMetal, V(1.24, 0.27, 0));
    }
    for (const s of SIDES) {
      const p = part('fshaft' + sideName(s), { label: 'Front drive shaft', tags: [...tag, 'shaft'], stage: 6, order: 5, offset: V(0, 0.15, 0.6 * s), sub: { drive: V(0, 0, 0.1 * s) } });
      rod(p, V(1.355, 0.3, 0.14 * s), V(1.355, 0.34, 0.68 * s), 0.022, M.aluminium);
      for (const zz of [0.16, 0.64]) add(p, new THREE.CylinderGeometry(0.04, 0.028, 0.07, 16), M.black, V(1.355, 0.32, zz * s), [Math.PI / 2, 0, 0]);
    }
  }

  // ---- exhaust --------------------------------------------------------------
  function buildExhaust() {
    const p = part('exhaust', { label: 'Titanium exhaust', tags: ['exhaust'], stage: 9, order: 3, offset: V(-1.1, 0.42, 0), lift: 0.1 });
    for (const s of SIDES) {
      const pts = [V(-0.75, 0.44, 0.47 * s), V(-1.25, 0.4, 0.55 * s), V(-1.75, 0.38, 0.45 * s), V(-1.98, 0.32, 0.22 * s)];
      add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.04, 12), M.titanium);
    }
    add(p, rbox(0.28, 0.2, 0.72, 0.08), M.titanium, V(-1.98, 0.36, 0));
    add(p, new THREE.CylinderGeometry(0.085, 0.085, 0.14, 32, 1, true), M.titanium, V(-2.18, 0.4, 0), [0, 0, Math.PI / 2], V(1, 1, 1.6));
    add(p, new THREE.CircleGeometry(0.08, 32), M.black, V(-2.19, 0.4, 0), [0, -Math.PI / 2, 0], V(1, 1.6, 1));
  }

  // ---- cooling --------------------------------------------------------------
  function buildCooling() {
    const tag = ['cooling'];
    {
      const p = part('radiatorsFront', { label: 'Front radiators', tags: tag, stage: 7, order: 9, offset: V(0.35, 1.05, 0), lift: 0 });
      add(p, rbox(0.06, 0.32, 0.7, 0.01), M.radiator, V(1.9, 0.34, 0), [0, 0, 0.35]);
      for (const s of SIDES) add(p, rbox(0.05, 0.3, 0.4, 0.01), M.radiator, V(1.75, 0.33, 0.62 * s), [0, 0.5 * s, 0.25]);
    }
    for (const s of SIDES) {
      const p = part('radiatorSide' + sideName(s), { label: 'Charge-air cooler', tags: tag, stage: 7, order: 9, offset: V(0.0, 1.2, 0.45 * s), lift: 0 });
      add(p, rbox(0.38, 0.28, 0.05, 0.01), M.radiator, V(-0.32, 0.55, 0.78 * s), [0, 0.35 * s, 0]);
    }
    {
      const p = part('coolantLines', { label: 'Coolant circuit', tags: tag, stage: 7, order: 9, offset: V(0, 0.55, 0), lift: 0 });
      for (const s of SIDES) {
        const pts = [V(1.85, 0.24, 0.3 * s), V(1.1, 0.16, 0.62 * s), V(0.0, 0.16, 0.66 * s), V(-0.55, 0.26, 0.5 * s), V(-0.75, 0.32, 0.28 * s)];
        add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.018, 8), M.aluminium);
      }
    }
  }

  // ---- structure -----------------------------------------------------------
  function buildStructure() {
    const tag = ['structure'];
    {
      const p = part('monocoque', { label: 'Carbon monocoque', tags: [...tag, 'carbon'], stage: 10, order: 1, offset: V(0, 0.0, 0), lift: 0.1 });
      add(p, rbox(1.45, 0.06, 1.42, 0.03), M.carbonMatte, V(0.2, 0.14, 0)); // tub floor
      for (const s of SIDES) add(p, rbox(1.45, 0.26, 0.18, 0.06), M.carbon, V(0.2, 0.27, 0.66 * s)); // sills
      add(p, rbox(0.12, 0.55, 1.42, 0.05), M.carbon, V(-0.48, 0.42, 0)); // rear bulkhead
      add(p, rbox(0.22, 0.32, 1.3, 0.06), M.carbon, V(0.88, 0.3, 0)); // front bulkhead / footwell
      add(p, rbox(1.45, 0.16, 0.2, 0.05), M.carbonMatte, V(0.2, 0.22, 0)); // central tunnel
      // A-pillar hoop and roof frame
      for (const s of SIDES) {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
          const u = 0.3 + 0.36 * (i / 20);
          pts.push(B.canopyPoint(u, s > 0 ? 0.08 : 0.92).add(V(0, -0.015, -0.025 * s)));
        }
        add(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.018, 8), M.carbonMatte);
      }
    }
    {
      const p = part('floor', { label: 'Flat underbody', tags: [...tag, 'carbon'], stage: 10, order: 1, offset: V(0, 0, 0), lift: 0 });
      add(p, rbox(3.7, 0.018, 1.7, 0.008), M.carbonMatte, V(0, 0.105, 0));
    }
    {
      const p = part('frontFrame', { label: 'Front crash structure', tags: [...tag, 'frame'], stage: 10, order: 1, offset: V(0.7, 0.0, 0), lift: 0.08 });
      for (const s of SIDES) {
        rod(p, V(0.98, 0.3, 0.45 * s), V(2.1, 0.3, 0.4 * s), 0.035, M.aluminium);
        rod(p, V(0.98, 0.55, 0.5 * s), V(1.8, 0.48, 0.45 * s), 0.028, M.aluminium);
        rod(p, V(1.8, 0.48, 0.45 * s), V(2.1, 0.3, 0.4 * s), 0.028, M.aluminium);
        rod(p, V(1.355, 0.3, 0.42 * s), V(1.355, 0.52, 0.46 * s), 0.025, M.aluminium);
      }
      rod(p, V(2.1, 0.3, 0.42), V(2.1, 0.3, -0.42), 0.04, M.aluminium);
      add(p, rbox(0.06, 0.18, 1.0, 0.02), M.carbon, V(2.15, 0.3, 0));
    }
    {
      const p = part('rearFrame', { label: 'Rear subframe', tags: [...tag, 'frame'], stage: 10, order: 1, offset: V(-0.35, 0.0, 0), lift: 0.08 });
      for (const s of SIDES) {
        rod(p, V(-0.52, 0.2, 0.6 * s), V(-1.95, 0.2, 0.5 * s), 0.03, M.gunmetal);
        rod(p, V(-0.52, 0.7, 0.6 * s), V(-1.6, 0.66, 0.55 * s), 0.03, M.gunmetal);
        rod(p, V(-1.6, 0.66, 0.55 * s), V(-1.95, 0.2, 0.5 * s), 0.03, M.gunmetal);
        rod(p, V(-1.0, 0.2, 0.58 * s), V(-1.1, 0.68, 0.58 * s), 0.025, M.gunmetal);
        rod(p, V(-1.355, 0.2, 0.54 * s), V(-1.355, 0.66, 0.56 * s), 0.025, M.gunmetal);
      }
      rod(p, V(-1.95, 0.2, 0.5), V(-1.95, 0.2, -0.5), 0.032, M.gunmetal);
      rod(p, V(-1.6, 0.66, 0.55), V(-1.6, 0.66, -0.55), 0.028, M.gunmetal);
    }
    {
      // titanium mounting points — revealed and highlighted in the structure chapter
      const p = part('mounts', { label: 'Mounting points', tags: [...tag, 'mounts'], stage: 10, order: 1, offset: V(0, 0, 0), lift: 0 });
      const pts = [[0.98, 0.3, 0.45], [0.98, 0.55, 0.5], [-0.52, 0.2, 0.6], [-0.52, 0.7, 0.6], [1.355, 0.52, 0.46], [-1.355, 0.66, 0.56], [0.85, 0.46, 0.66], [-0.45, 0.68, 0.66]];
      for (const s of SIDES) for (const q of pts) add(p, new THREE.SphereGeometry(0.03, 14, 10), M.mount, V(q[0], q[1], q[2] * s));
    }
  }

  // ---- interior -----------------------------------------------------------
  function buildInterior() {
    const tag = ['interior'];
    for (const s of SIDES) {
      const p = part('seat' + sideName(s), { label: 'Hand-stitched seat', tags: [...tag, 'seat'], stage: 11, order: 2, offset: V(0, 0.55, 0.1 * s), lift: 0 });
      const zc = 0.34 * s, x0 = -0.05;
      add(p, rbox(0.52, 0.1, 0.46, 0.04), M.leather, V(x0 + 0.08, 0.25, zc));
      add(p, rbox(0.1, 0.66, 0.46, 0.045), M.leather, V(x0 - 0.2, 0.55, zc), [0, 0, -0.32]);
      for (const b of [-1, 1]) {
        add(p, rbox(0.46, 0.09, 0.07, 0.03), M.leatherDark, V(x0 + 0.08, 0.3, zc + 0.21 * b));
        add(p, rbox(0.12, 0.55, 0.07, 0.03), M.leatherDark, V(x0 - 0.17, 0.55, zc + 0.21 * b), [0, 0, -0.32]);
      }
      add(p, rbox(0.05, 0.16, 0.24, 0.03), M.leatherDark, V(x0 - 0.31, 0.92, zc), [0, 0, -0.32]);
    }
    {
      const p = part('dashboard', { label: 'Dashboard', tags: [...tag, 'dash'], stage: 11, order: 2, offset: V(0.25, 0.75, 0), lift: 0 });
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.quadraticCurveTo(0.25, 0.02, 0.36, -0.12); sh.lineTo(0.2, -0.16); sh.quadraticCurveTo(0.08, -0.06, 0, -0.08); sh.lineTo(0, 0);
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
      g.translate(0, 0, -0.65);
      add(p, g, M.leatherDark, V(0.56, 0.74, 0));
      add(p, rbox(0.02, 0.012, 1.25, 0.004), M.aluminium, V(0.56, 0.735, 0));
      for (const s of SIDES) add(p, new THREE.TorusGeometry(0.035, 0.008, 8, 24), M.aluminium, V(0.6, 0.7, 0.55 * s), [0, Math.PI / 2, 0]);
    }
    {
      const p = part('console', { label: 'Centre console spine', tags: [...tag, 'console'], stage: 11, order: 2, offset: V(0, 0.65, 0), lift: 0 });
      const curve = new THREE.CatmullRomCurve3([V(0.62, 0.68, 0), V(0.5, 0.48, 0), V(0.28, 0.36, 0), V(-0.1, 0.34, 0), V(-0.35, 0.4, 0)]);
      const sh = new THREE.Shape();
      sh.moveTo(-0.012, -0.05); sh.lineTo(0.012, -0.05); sh.lineTo(0.012, 0.05); sh.lineTo(-0.012, 0.05);
      add(p, new THREE.ExtrudeGeometry(sh, { steps: 60, bevelEnabled: false, extrudePath: curve }), M.aluminium);
      add(p, rbox(0.6, 0.1, 0.16, 0.04), M.leatherDark, V(0.12, 0.3, 0));
      for (let i = 0; i < 4; i++) {
        const t = 0.32 + i * 0.07;
        const q = curve.getPoint(t);
        add(p, new THREE.CylinderGeometry(0.022, 0.022, 0.028, 24), M.chrome, q.clone().add(V(0, 0.0, 0.02)), [Math.PI / 2, 0, 0]);
      }
    }
    {
      const p = part('steering', { label: 'Steering wheel', tags: [...tag, 'steering-wheel'], stage: 11, order: 2, offset: V(0.15, 0.85, 0), lift: 0 });
      const g = new THREE.Group();
      g.position.set(0.36, 0.66, -0.36);
      g.rotation.set(0, Math.PI / 2, 0);
      g.rotateX(-0.35);
      p.group.add(g);
      const rim = mesh(new THREE.TorusGeometry(0.17, 0.019, 14, 64), M.leatherDark);
      g.add(rim);
      for (const a of [Math.PI, 0, -Math.PI / 2]) {
        const sp = mesh(rbox(0.15, 0.03, 0.015, 0.006), M.aluminium);
        sp.position.set(Math.cos(a) * 0.085, Math.sin(a) * 0.085, 0);
        sp.rotation.z = a;
        g.add(sp);
      }
      const hub = mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 32), M.leatherDark);
      hub.rotation.x = Math.PI / 2;
      g.add(hub);
      const badge = mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 24), M.enamel);
      badge.rotation.x = Math.PI / 2;
      badge.position.z = 0.025;
      badge.scale.set(1.5, 1, 1);
      g.add(badge);
      rod(p, V(0.36, 0.66, -0.36), V(0.62, 0.6, -0.36), 0.02, M.darkMetal);
    }
    {
      const p = part('cluster', { label: 'Instrument cluster', tags: [...tag, 'cluster'], stage: 11, order: 2, offset: V(0.2, 0.95, 0), lift: 0 });
      add(p, rbox(0.1, 0.12, 0.34, 0.03), M.leatherDark, V(0.56, 0.78, -0.36), [0, 0, -0.4]);
      for (const [dz, r] of [[-0.11, 0.04], [0, 0.055], [0.11, 0.04]]) {
        const dial = add(p, new THREE.CircleGeometry(r, 40), M.gauge, V(0.505, 0.775, -0.36 + dz), [0, -Math.PI / 2, 0]);
        dial.rotateX(-0.4);
        dial.castShadow = false;
        const ring = add(p, new THREE.TorusGeometry(r, 0.004, 6, 40), M.chrome, dial.position.clone().add(V(-0.002, 0, 0)), [0, -Math.PI / 2, 0]);
        ring.rotateX(-0.4);
      }
    }
    {
      const p = part('pedals', { label: 'Pedal box', tags: [...tag, 'pedals'], stage: 12, order: 2, offset: V(0.35, 0.6, 0), lift: 0 });
      for (const [dz, w] of [[-0.48, 0.05], [-0.38, 0.09], [-0.28, 0.08]]) {
        add(p, rbox(0.02, 0.11, w, 0.006), M.aluminium, V(0.84, 0.3, dz), [0, 0, 0.35]);
        rod(p, V(0.86, 0.35, dz), V(0.9, 0.5, dz), 0.008, M.darkMetal);
      }
    }
  }

  // ---- finalise: centre each component on its own pivot -------------------
  const box = new THREE.Box3(), c = new THREE.Vector3();
  for (const p of parts) {
    p.group.updateMatrixWorld(true);
    box.setFromObject(p.group);
    box.getCenter(c);
    p.group.children.forEach((ch) => ch.position.sub(c));
    p.group.position.copy(c);
    p.home = { pos: c.clone(), quat: p.group.quaternion.clone() };
    p.center = c.clone();
    p.size = box.getSize(new THREE.Vector3());
    p.explodeQuat = new THREE.Quaternion().setFromEuler(p.rot);
    p.meshes = [];
    p.group.traverse((o) => { if (o.isMesh) { o.userData.part = p; p.meshes.push(o); } });
  }
  return { root, parts, byKey };
}

// ---------------------------------------------------------------------------
// geometry helpers
// ---------------------------------------------------------------------------
// approximate forward reach of the rounded nose at a given v
function B_noseX(v) {
  return 0.13 * (0.6 + 0.4 * Math.sin(v * Math.PI));
}

function horseshoe(w, h) {
  const s = new THREE.Shape();
  s.moveTo(-w * 0.62, -h * 0.5);
  s.bezierCurveTo(-w * 1.05, h * 0.05, -w * 0.95, h * 0.62, 0, h * 0.62);
  s.bezierCurveTo(w * 0.95, h * 0.62, w * 1.05, h * 0.05, w * 0.62, -h * 0.5);
  s.quadraticCurveTo(0, -h * 0.66, -w * 0.62, -h * 0.5);
  return s;
}

function intakeGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.22, -0.07);
  s.quadraticCurveTo(-0.24, 0.07, -0.08, 0.09);
  s.lineTo(0.2, 0.06);
  s.quadraticCurveTo(0.24, -0.02, 0.18, -0.08);
  s.closePath();
  const g = new THREE.ShapeGeometry(s, 16);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 4, uv.getY(i) * 4);
  return g;
}

function tireGeometry(R, rimR, w) {
  const h = w * 0.5;
  const pts = [];
  const sh = R - rimR;
  // profile from inner bead, up the sidewall, across the tread (with grooves), down
  pts.push([rimR - 0.004, -h + 0.02], [rimR + sh * 0.35, -h - 0.004], [R - 0.03, -h + 0.004], [R - 0.008, -h + 0.03], [R, -h + 0.06]);
  const grooves = [-0.5, -0.17, 0.17, 0.5];
  for (let i = 0; i <= 20; i++) {
    const y = -h + 0.06 + (i / 20) * (w - 0.12);
    const yn = y / (h - 0.06);
    const g = grooves.some((q) => Math.abs(yn - q) < 0.045);
    pts.push([g ? R - 0.008 : R, y]);
  }
  pts.push([R, h - 0.06], [R - 0.008, h - 0.03], [R - 0.03, h - 0.004], [rimR + sh * 0.35, h + 0.004], [rimR - 0.004, h - 0.02]);
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 96);
}

function archLiner(a, s) {
  const g = new THREE.CylinderGeometry(a.r - 0.01, a.r - 0.01, 0.5, 40, 1, true, Math.PI * 0.42, Math.PI * 1.16);
  g.rotateX(Math.PI / 2);
  // cylinder angle 0 points to +z before rotation; after rotateX it maps to -y.
  g.translate(a.x, a.y, s * 0.78);
  return g;
}

function offsetAlongNormals(geo, d) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
}

class HelixCurve extends THREE.Curve {
  constructor(r, len, turns) { super(); this.r = r; this.len = len; this.turns = turns; }
  getPoint(t, out = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return out.set(Math.cos(a) * this.r, t * this.len, Math.sin(a) * this.r);
  }
}

export function roundedBox(w, h, d, r = 0.02, seg = 3) {
  r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(Math.max(-hx, Math.min(hx, v.x)), Math.max(-hy, Math.min(hy, v.y)), Math.max(-hz, Math.min(hz, v.z)));
    v.sub(c);
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(r);
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  g.computeVertexNormals();
  return g;
}
