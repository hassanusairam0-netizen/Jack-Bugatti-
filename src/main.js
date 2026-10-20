import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createMaterials, setHighlight } from './materials.js';
import { radialTexture } from './textures.js';
import { buildCar } from './car.js';
import * as S from './story.js';
import { Sound } from './sound.js';
import { clamp, lerp, rise, window01, DEG } from './util.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const isSmall = () => innerWidth < 760;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const loader = {
  bar: $('#loader .bar i'),
  label: $('#loader .step'),
  set(p, text) { this.bar.style.transform = `scaleX(${p})`; if (text) this.label.textContent = text; },
};

async function start() {
  buildDomText();
  if (!hasWebGL()) {
    document.body.classList.add('no-webgl');
    $('#loader').classList.add('done');
    setupScroll(() => {});
    return;
  }
  loader.set(0.08, 'Preparing the studio');
  await nextFrame();

  // --- renderer ------------------------------------------------------------
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio, coarse ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x07080b);
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 14, 34);
  const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 120);

  // --- studio environment: softboxes rendered into a PMREM ----------------
  loader.set(0.2, 'Lighting the softboxes');
  await nextFrame();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(buildStudioEnv(), 0.02).texture;
  scene.environmentIntensity = 1;

  // --- floor, reflection, contact shadow, volumetric light ----------------
  const mobileFloor = coarse || isSmall();
  let reflector = null;
  if (!mobileFloor) {
    reflector = new Reflector(new THREE.PlaneGeometry(70, 70), {
      textureWidth: innerWidth * 0.5, textureHeight: innerHeight * 0.5, color: 0x8a8d94, clipBias: 0.003,
    });
    reflector.rotation.x = -Math.PI / 2;
    scene.add(reflector);
  }
  // polished floor: a half-resolution mirror under a dark, slightly transparent
  // satin layer on desktop; a plain satin floor on mobile
  const floorMat = new THREE.MeshLambertMaterial({ color: 0x0b0c0f, transparent: !mobileFloor, opacity: mobileFloor ? 1 : 0.86 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  scene.add(floor);
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(5.4, 2.6),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.9)'), transparent: true, depthWrite: false, opacity: 0.85 }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.003;
  scene.add(contact);
  const beam = volumetricBeam();
  scene.add(beam);

  // --- lights --------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0x22324d, 0x050505, 0.35);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6ea, 2.4);
  key.position.set(4, 9, 5);
  key.castShadow = true;
  const sm = coarse ? 1024 : 2048;
  key.shadow.mapSize.set(sm, sm);
  Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd3ff, 3);
  rim.position.set(-7, 3.5, -5);
  scene.add(rim);
  const rimWarm = new THREE.DirectionalLight(0xffd7a8, 1.2);
  rimWarm.position.set(-5, 2.2, 6);
  scene.add(rimWarm);
  const spot = new THREE.SpotLight(0xfff0d8, 0, 14, 0.42, 0.75, 1.4);
  scene.add(spot, spot.target);

  // --- the car --------------------------------------------------------------
  loader.set(0.35, 'Sculpting the bodywork');
  await nextFrame();
  const M = createMaterials();
  const car = buildCar(M, coarse || isSmall() ? 0.7 : 1);
  scene.add(car.root);
  loader.set(0.7, 'Assembling the components');
  await nextFrame();

  const ghost = createGhosting();
  const flow = buildPowerFlow(car);
  scene.add(flow.group);

  // --- annotations ------------------------------------------------------------
  const calloutLayer = $('#callouts');
  const svg = $('#callout-lines');
  const callouts = S.CALLOUTS.map((c) => {
    const el = document.createElement('div');
    el.className = 'callout';
    el.innerHTML = `<i class="dot"></i><div class="label"><h4>${c.title}</h4><p>${c.text}</p></div>`;
    calloutLayer.appendChild(el);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    svg.appendChild(line);
    const part = car.byKey[c.part];
    return { ...c, el, line, part, local: new THREE.Vector3(...c.at).sub(part.home.pos) };
  });

  // --- interaction state ----------------------------------------------------
  const view = { yaw: 0, pitch: 0, vYaw: 0, vPitch: 0, dragging: false, resetting: false };
  let selected = null;
  let selBlend = 0;
  let freeMode = false;
  setupDrag(canvas, view, () => (freeMode ? 80 : 32));
  $('#reset-view').addEventListener('click', () => { view.resetting = true; view.vYaw = view.vPitch = 0; });

  const sound = new Sound();
  $('#sound').addEventListener('click', () => {
    const on = sound.toggle();
    $('#sound').classList.toggle('on', on);
    $('#sound span').textContent = on ? 'Sound on' : 'Sound off';
  });

  // control-chapter selector
  const chips = $('#chips');
  for (const s of S.SELECTABLE) {
    const b = document.createElement('button');
    b.textContent = s.title;
    b.dataset.key = s.key;
    b.addEventListener('click', () => select(selected === s.key ? null : s.key));
    chips.appendChild(b);
  }
  function select(k) {
    selected = k;
    $$('#chips button').forEach((b) => b.classList.toggle('active', b.dataset.key === k));
    const info = S.SELECTABLE.find((s) => s.key === k);
    $('#chip-info').innerHTML = info ? `<h4>${info.title}</h4><p>${info.text}</p>` : '<p class="muted">Select a component, or tap it in the scene.</p>';
  }
  select(null);

  // click-to-select in the scene (only in the Control chapter)
  const ray = new THREE.Raycaster();
  canvas.addEventListener('click', (e) => {
    if (view.moved || S.chapterAt(state.p).id !== 'control') return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(car.root.children, true);
    for (const h of hits) {
      const k = h.object.userData.part?.key;
      if (k && S.SELECTABLE.some((s) => s.key === k)) { select(k); return; }
    }
  });

  $('#again').addEventListener('click', () => {
    freeMode = false;
    document.body.classList.remove('free');
    const veil = $('#veil');
    veil.classList.add('on');
    setTimeout(() => {
      window.scrollTo(0, 0);
      ScrollTrigger.update();
      view.yaw = view.pitch = 0;
      setTimeout(() => veil.classList.remove('on'), reduceMotion ? 100 : 1500);
    }, 900);
  });
  $('#explore').addEventListener('click', () => {
    freeMode = !freeMode;
    document.body.classList.toggle('free', freeMode);
    $('#explore').textContent = freeMode ? 'Return to the film' : 'Explore freely';
    if (!freeMode) view.resetting = true;
  });

  // --- scroll ------------------------------------------------------------------
  const state = { p: 0, raw: 0 };
  window.__state = state;
  setupScroll((p) => { state.raw = p; });

  // --- resize & adaptive resolution -------------------------------------------
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (reflector) {
      reflector.getRenderTarget().setSize(innerWidth * pixelRatio * 0.5, innerHeight * pixelRatio * 0.5);
    }
  }
  addEventListener('resize', resize);

  // --- frame ------------------------------------------------------------------
  const ui = { progress: $('#progress i'), stages: $$('#stages li'), hint: $('#hint'), reset: $('#reset-view') };
  window.__view = view;
  const clock = new THREE.Clock();
  const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), proj = new THREE.Vector3();
  let lastChapter = null, crank = 0, lastP = 0;
  const assembled = new Set();
  let accentDone = false;

  function applyFrame(p, t) {
    const amt = S.chapterAmounts(p);
    // components
    for (const part of car.parts) {
      const e = S.explodeAmount(part, p, amt);
      const g = part.group;
      g.position.copy(part.home.pos).addScaledVector(part.offset, e);
      g.position.y += part.lift * Math.sin(Math.PI * e);
      for (const k in part.sub) if (amt[k]) g.position.addScaledVector(part.sub[k], amt[k]);
      tmpQ.copy(part.home.quat).multiply(part.explodeQuat);
      g.quaternion.copy(part.home.quat).slerp(tmpQ, e);
      part.e = e;
      ghost.apply(part, S.ghostAmount(part, amt), S.isShell(part) ? 'shell' : 'mech');
    }
    ghost.commit();
    // representative piston motion, only while the heads are lifted
    const pistons = car.byKey['engine.pistons'].pistons;
    for (const pis of pistons) pis.position.y = pis.userData.baseY - 0.012 * (1 + Math.sin(crank + pis.userData.phase)) * Math.min(1, amt.engine * 4);
    car.byKey['engine.block'].group.traverse((o) => { if (o.userData.spin) o.rotation.x = crank; });

    // highlights (callouts + system groups + selection)
    const hl = new Map();
    for (const c of S.CALLOUTS) {
      if (c.hl === false) continue;
      const a = window01(p, c.from, c.from + 0.008, c.to - 0.008, c.to);
      if (a > 0) hl.set(c.part, Math.max(hl.get(c.part) || 0, a * 0.9));
    }
    for (const h of S.HIGHLIGHTS) {
      const a = window01(p, h.from, h.from + 0.01, h.to - 0.01, h.to) * h.amount;
      if (a > 0) for (const part of car.parts) if (part.tags.some((x) => h.tags.includes(x))) hl.set(part.key, Math.max(hl.get(part.key) || 0, a));
    }
    if (selected && amt.wheel > 0.01) hl.set(selected, amt.wheel);
    for (const part of car.parts) {
      const a = hl.get(part.key) || 0;
      if ((a > 0 || part.hl > 0) && !part.ghost) part.meshes.forEach((m) => setHighlight(m, a));
      part.hl = a;
    }

    // camera
    const cam = S.cameraAt(p);
    if (!reduceMotion && t) {
      const calm = 1 - window01(p, 0.03, 0.06, 0.95, 0.99);
      cam.az += Math.sin(t * 0.09) * 2.2 * calm;
      cam.el += Math.sin(t * 0.13) * 0.5 * calm;
      cam.dist *= 1 + Math.sin(t * 0.07) * 0.012 * calm;
    }
    // portrait screens: widen the lens, then step back
    const aspect = innerWidth / innerHeight;
    const baseTan = Math.tan((cam.fov * DEG) / 2);
    const want = (baseTan * 1.4) / aspect;
    let fovTan = Math.max(baseTan, Math.min(want, Math.tan(26 * DEG)));
    const distK = Math.max(1, want / fovTan);
    camera.fov = (2 * Math.atan(fovTan)) / DEG;
    // selected component in the Control chapter draws the camera in
    selBlend = lerp(selBlend, selected && amt.wheel > 0.5 ? 1 : 0, 0.05);
    const target = tmpV.set(cam.tx, cam.ty, cam.tz);
    let dist = cam.dist * distK;
    if (selBlend > 0.001 && selected) {
      const g = car.byKey[selected].group;
      target.lerp(g.position, selBlend * 0.7);
      dist = lerp(dist, dist * 0.72, selBlend);
    }
    const az = (cam.az + view.yaw) * DEG;
    const el = clamp(cam.el + view.pitch, 1.5, 80) * DEG;
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.cos(az),
      target.y + dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.sin(az),
    );
    camera.position.y = Math.max(camera.position.y, 0.12);
    camera.lookAt(target);
    // frame the car away from the editorial text (right on wide screens, up on portrait)
    if (aspect > 1.1) {
      const shift = 0.085 + 0.07 * (1 - rise(p, 0.03, 0.07)) + 0.06 * rise(p, 0.95, 0.975);
      camera.setViewOffset(innerWidth, innerHeight, -shift * innerWidth, 0, innerWidth, innerHeight);
    } else {
      camera.setViewOffset(innerWidth, innerHeight, 0, 0.1 * innerHeight, innerWidth, innerHeight);
    }
    camera.updateProjectionMatrix();

    // lighting
    const [env, keyI, rimI, spotI, expo] = S.lightsAt(p);
    scene.environmentIntensity = env;
    key.intensity = keyI;
    rim.intensity = rimI;
    rimWarm.intensity = rimI * 0.4;
    spot.intensity = spotI;
    spot.position.set(target.x + 1.5, target.y + 4.5, target.z + 1.5);
    spot.target.position.copy(target);
    renderer.toneMappingExposure = expo;
    beam.material.uniforms.uIntensity.value = 0.05 + 0.05 * window01(p, 0.86, 0.93, 1.1, 1.2);

    // power-flow lines
    const fv = window01(p, 0.495, 0.512, 0.556, 0.572);
    flow.update(fv, t);
    return amt;
  }

  function frame() {
    const t = clock.getElapsedTime();
    const p = window.__forceP ?? state.raw;
    const dp = Math.abs(p - lastP);
    lastP = p;
    state.p = p;
    crank += (reduceMotion ? 1.2 : 2.6) * 0.016;

    // drag inertia, release settling, scroll-driven return to composition
    if (!view.dragging) {
      view.yaw += view.vYaw; view.pitch += view.vPitch;
      view.vYaw *= 0.86; view.vPitch *= 0.86;
      if (!freeMode) {
        const k = Math.exp(-dp * 70);
        view.yaw *= k; view.pitch *= k;
      }
      if (view.resetting) {
        view.yaw *= 0.93; view.pitch *= 0.93;
        if (Math.abs(view.yaw) + Math.abs(view.pitch) < 0.05) { view.yaw = view.pitch = 0; view.resetting = false; }
      }
    }
    if (!freeMode) view.pitch = clamp(view.pitch, -14, 30);
    ui.reset.classList.toggle('show', Math.abs(view.yaw) + Math.abs(view.pitch) > 2);

    applyFrame(p, t);

    // callouts
    const w = innerWidth, h = innerHeight, small = isSmall();
    for (const c of callouts) {
      let a = freeMode ? 0 : window01(p, c.from, c.from + 0.006, c.to - 0.006, c.to);
      if (c.sel && selected) a *= c.sel === selected ? 1 : 0.0;
      if (a < 0.01) { if (c.vis) { c.el.style.opacity = 0; c.line.style.opacity = 0; c.vis = false; } continue; }
      const g = c.part.group;
      proj.copy(c.local).applyQuaternion(g.quaternion).add(g.position).project(camera);
      if (proj.z > 1) a = 0;
      const x = (proj.x * 0.5 + 0.5) * w, y = (-proj.y * 0.5 + 0.5) * h;
      const ex = small ? 26 : 46, ey = small ? -34 : -54, lx = small ? 14 : 30, lw = small ? 160 : 240;
      let dir = x > w * 0.68 ? -1 : 1;
      if (dir > 0 && x + ex + lx + lw > w) dir = -1;
      else if (dir < 0 && x - ex - lx - lw < 0) dir = 1;
      const kx = x + dir * ex, ky = y + ey;
      c.el.style.opacity = a;
      c.el.style.transform = `translate(${x}px, ${y}px)`;
      c.el.classList.toggle('left', dir < 0);
      c.el.style.setProperty('--lx', `${dir * (ex + lx)}px`);
      c.el.style.setProperty('--ly', `${ey}px`);
      c.line.setAttribute('points', `${x},${y} ${kx},${ky} ${kx + dir * lx},${ky}`);
      c.line.style.opacity = a;
      c.vis = true;
    }

    // text panels & UI
    for (const el of textPanels) {
      const a = freeMode && !el.classList.contains('keep') ? 0 : window01(p, el._f, el._f + el._fade, el._t - el._fade, el._t);
      el.style.opacity = a;
      el.style.transform = `translateY(${(1 - a) * 14}px)`;
      el.style.visibility = a > 0.001 ? 'visible' : 'hidden';
    }
    const ch = S.chapterAt(p);
    if (ch !== lastChapter) {
      lastChapter = ch;
      $('#chapter-num').textContent = `${ch.num} / 06`;
      $('#chapter-title').textContent = ch.title;
      $('#indicator').classList.remove('flip'); void $('#indicator').offsetWidth; $('#indicator').classList.add('flip');
      document.body.dataset.chapter = ch.id;
      if (ch.id !== 'control') select(null);
    }
    ui.progress.style.transform = `scaleX(${p})`;
    ui.stages.forEach((li, i) => li.classList.toggle('on', p >= S.stageStart(i + 1) + 0.004));
    const hint = p < 0.03 ? 'Scroll to discover' : 'Scroll to explore · Drag to rotate';
    if (ui.hint.textContent !== hint) ui.hint.textContent = hint;
    ui.hint.style.opacity = p > 0.955 && !freeMode ? 0 : 1;

    // reassembly sound cues
    if (p > 0.84 && p < 0.99) {
      for (const part of car.parts) {
        const done = p >= S.orderEnd(part.order) - 0.002;
        if (done && !assembled.has(part.order) && part.e < 0.02 && dp > 0) { assembled.add(part.order); sound.click(0.6 + Math.random() * 0.4); }
      }
      if (!accentDone && p > S.orderEnd(15)) { accentDone = true; sound.accent(); }
    }
    if (p < 0.83) { assembled.clear(); accentDone = false; }

    renderer.render(scene, camera);

    requestAnimationFrame(frame);
    perf.tick(() => {
      if (pixelRatio > 1) { pixelRatio = Math.max(1, pixelRatio - 0.25); renderer.setPixelRatio(pixelRatio); resize(); }
    });
  }
  loader.set(0.88, 'Polishing the clearcoat');
  await nextFrame();
  applyFrame(0, 0);
  renderer.compile(scene, camera);
  renderer.render(scene, camera);
  loader.set(1, 'Ready');
  await nextFrame();
  setTimeout(() => $('#loader').classList.add('done'), 350);
  document.body.classList.add('ready');

  requestAnimationFrame(frame);
}

// X-ray ghosting: each mesh cross-fades between its solid material and a
// fresnel "shell" twin that shares its geometry.
function createGhosting() {
  const ghostMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0x9fb8e8) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uOpacity; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
        gl_FragColor = vec4(uColor * (0.035 + 0.55*f) * uOpacity, 1.0); }`,
  });
  const ghostMats = { shell: ghostMat, mech: ghostMat.clone() };
  ghostMats.mech.uniforms.uColor.value = new THREE.Color(0xcdb68a);
  const fades = { shell: new Map(), mech: new Map() };
  const fadeOf = (group, base) => {
    const cache = fades[group];
    if (!cache.has(base)) {
      const mk = (b) => { const c = b.clone(); c.transparent = true; return c; };
      cache.set(base, Array.isArray(base) ? base.map(mk) : mk(base));
    }
    return cache.get(base);
  };
  const level = { shell: 0, mech: 0 };
  return {
    apply(part, g, group) {
      level[group] = Math.max(level[group], g);
      if (g <= 0.001 && !part.ghost) return;
      const solidOpacity = 1 - Math.min(1, g / 0.7);
      for (const m of part.meshes) {
        const base = m.userData.baseMat || (m.userData.baseMat = m.material);
        if (!m.userData.twin) {
          const tw = new THREE.Mesh(m.geometry, ghostMats[group]);
          tw.renderOrder = 3;
          m.add(tw);
          m.userData.twin = tw;
        }
        m.userData.twin.visible = g > 0.001;
        if (m.userData.cast === undefined) m.userData.cast = m.castShadow;
        if (g <= 0.001) { m.material = base; m.castShadow = m.userData.cast; continue; }
        m.castShadow = m.userData.cast && solidOpacity > 0.5;
        const f = fadeOf(group, base);
        (Array.isArray(f) ? f : [f]).forEach((x, i) => {
          x.opacity = solidOpacity * ((Array.isArray(base) ? base[i] : base).opacity ?? 1);
          x.depthWrite = solidOpacity > 0.5;
          x.visible = solidOpacity > 0.002;
        });
        m.material = f;
      }
      part.ghost = g > 0.001;
    },
    // called once per frame after all parts are applied
    commit() {
      ghostMats.shell.uniforms.uOpacity.value = level.shell;
      ghostMats.mech.uniforms.uOpacity.value = level.mech;
      level.shell = level.mech = 0;
    },
  };
}

// rolling frame-time monitor that lowers resolution when the GPU struggles
const perf = {
  n: 0, last: performance.now(), acc: 0, cooldown: 0,
  tick(onSlow) {
    const now = performance.now();
    this.acc += now - this.last; this.last = now; this.n++;
    if (this.n >= 90) {
      const avg = this.acc / this.n;
      this.n = 0; this.acc = 0;
      if (avg > 30 && this.cooldown-- <= 0) { onSlow(); this.cooldown = 2; }
    }
  },
};

// ---------------------------------------------------------------------------
const textPanels = [];
function buildDomText() {
  $$('[data-from]').forEach((el) => {
    el._f = parseFloat(el.dataset.from);
    el._t = parseFloat(el.dataset.to);
    el._fade = parseFloat(el.dataset.fade || 0.01);
    textPanels.push(el);
  });
  const ol = $('#stages');
  S.STAGES.forEach((s, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<b>${String(i + 1).padStart(2, '0')}</b>${s}`;
    ol.appendChild(li);
  });
}

function setupScroll(onUpdate) {
  const proxy = { p: 0 };
  gsap.to(proxy, {
    p: 1, ease: 'none',
    scrollTrigger: { trigger: '#track', start: 'top top', end: 'bottom bottom', scrub: reduceMotion ? true : 1.4 },
    onUpdate: () => onUpdate(proxy.p),
  });
  if (document.body.classList.contains('no-webgl')) {
    ScrollTrigger.create({ trigger: '#track', start: 'top top', end: 'bottom bottom', onUpdate: (st) => {
      textPanels.forEach((el) => { const a = window01(st.progress, el._f, el._f + el._fade, el._t - el._fade, el._t); el.style.opacity = a; el.style.visibility = a > 0 ? 'visible' : 'hidden'; });
    } });
  }
}

function setupDrag(canvas, view, maxPitch) {
  let id = null, sx = 0, sy = 0, lx = 0, ly = 0, axis = null;
  canvas.addEventListener('pointerdown', (e) => {
    id = e.pointerId; sx = lx = e.clientX; sy = ly = e.clientY; axis = null;
    view.dragging = true; view.moved = false; view.resetting = false;
    view.vYaw = view.vPitch = 0;
    document.body.classList.add('dragging');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    if (!axis && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
      axis = e.pointerType === 'touch' ? 'x' : 'xy';
      view.moved = true;
    }
    if (!axis) return;
    const k = 0.22;
    view.vYaw = clamp(dx * k, -1.6, 1.6);
    view.yaw += dx * k;
    if (axis === 'xy') {
      view.vPitch = clamp(dy * k * 0.5, -0.8, 0.8);
      view.pitch = clamp(view.pitch + dy * k * 0.5, -14, maxPitch());
    }
  });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null; view.dragging = false;
    document.body.classList.remove('dragging');
    setTimeout(() => { view.moved = false; }, 0);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', end);
}

// ---------------------------------------------------------------------------
function buildStudioEnv() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(40, 16, 40), new THREE.MeshBasicMaterial({ color: 0x07080a, side: THREE.BackSide }));
  room.position.y = 6;
  s.add(room);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ color: 0x0c0d10 }));
  ground.rotation.x = -Math.PI / 2;
  s.add(ground);
  const panel = (w, h, intensity, pos, rot, color = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    s.add(m);
  };
  panel(9, 3.4, 5, [0, 8, 0], [Math.PI / 2, 0, 0]); // overhead softbox
  panel(16, 0.55, 7, [0, 4.2, 9], [0, 0, 0]); // long side strips
  panel(16, 0.55, 7, [0, 4.2, -9], [0, 0, 0]);
  panel(16, 0.35, 3.5, [0, 1.6, 9.5], [0, 0, 0], 0xffe2bd);
  panel(16, 0.35, 3, [0, 1.6, -9.5], [0, 0, 0], 0xcfe0ff);
  panel(0.6, 6, 6, [12, 3.5, 0], [0, Math.PI / 2, 0]); // front and rear verticals
  panel(0.6, 6, 4, [-12, 3.5, 3], [0, Math.PI / 2, 0], 0xd0dcff);
  panel(5, 1.2, 2.2, [7, 6, 7], [-0.5, 0.8, 0], 0xffe6c8);
  panel(5, 1.2, 2.2, [-7, 6, -7], [0.5, 0.8, 0]);
  return s;
}

function volumetricBeam() {
  const geo = new THREE.CylinderGeometry(1.4, 4.4, 9, 48, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uIntensity: { value: 0.05 }, uColor: { value: new THREE.Color(0xfff1dc) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uIntensity; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ float edge = pow(abs(dot(vN, vV)), 2.5); float fall = smoothstep(0.0, 0.9, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y));
        gl_FragColor = vec4(uColor * edge * fall * uIntensity, 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 4.5;
  m.renderOrder = 5;
  return m;
}

// Thin flowing lines tracing torque from the engine to all four wheels.
function buildPowerFlow(car) {
  const group = new THREE.Group();
  const A = (key, x, y, z) => ({ part: car.byKey[key], local: new THREE.Vector3(x, y, z).sub(car.byKey[key].home.pos) });
  const paths = [
    [A('engine.block', -0.5, 0.3, 0), A('engine.block', -1.2, 0.3, 0), A('transmission', -1.55, 0.36, 0), A('transmission', -1.36, 0.34, 0)],
    [A('transmission', -1.36, 0.34, 0), A('halfshaftR', -1.355, 0.35, 0.4), A('RR.rim', -1.355, 0.355, 0.86)],
    [A('transmission', -1.36, 0.34, 0), A('halfshaftL', -1.355, 0.35, -0.4), A('RL.rim', -1.355, 0.355, -0.86)],
    [A('transmission', -1.45, 0.2, 0), A('propshaft', -1.2, 0.17, 0), A('propshaft', 1.2, 0.23, 0), A('frontDiff', 1.33, 0.29, 0)],
    [A('frontDiff', 1.33, 0.29, 0), A('fshaftR', 1.355, 0.32, 0.4), A('FR.rim', 1.355, 0.34, 0.89)],
    [A('frontDiff', 1.33, 0.29, 0), A('fshaftL', 1.355, 0.32, -0.4), A('FL.rim', 1.355, 0.34, -0.89)],
  ];
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(0xe2c58f) } },
    vertexShader: `attribute float d; varying float vD; void main(){ vD = d; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uTime; uniform float uOpacity; uniform vec3 uColor; varying float vD;
      void main(){ float dash = smoothstep(0.35, 0.5, fract(vD*5.0 - uTime*0.9)) * (1.0 - smoothstep(0.75, 0.9, fract(vD*5.0 - uTime*0.9)));
        gl_FragColor = vec4(uColor, uOpacity * (0.28 + 0.72*dash)); }`,
  });
  const SEG = 24;
  const lines = paths.map((anchors) => {
    const n = (anchors.length - 1) * SEG + 1;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('d', new THREE.BufferAttribute(new Float32Array(n), 1));
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = 10;
    group.add(line);
    return { anchors, geo, n };
  });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
  const world = (an, out) => out.copy(an.local).applyQuaternion(an.part.group.quaternion).add(an.part.group.position);
  return {
    group,
    update(op, t) {
      group.visible = op > 0.001;
      if (!group.visible) return;
      mat.uniforms.uOpacity.value = op;
      mat.uniforms.uTime.value = t;
      for (const L of lines) {
        const pos = L.geo.attributes.position, d = L.geo.attributes.d;
        let k = 0, dist = 0;
        for (let i = 0; i < L.anchors.length - 1; i++) {
          world(L.anchors[i], a); world(L.anchors[i + 1], b);
          for (let j = 0; j < SEG + (i === L.anchors.length - 2 ? 1 : 0); j++) {
            q.lerpVectors(a, b, j / SEG);
            if (k > 0) dist += q.distanceTo(new THREE.Vector3(pos.getX(k - 1), pos.getY(k - 1), pos.getZ(k - 1)));
            pos.setXYZ(k, q.x, q.y, q.z);
            d.setX(k, dist);
            k++;
          }
        }
        pos.needsUpdate = true; d.needsUpdate = true;
      }
    },
  };
}

start();
