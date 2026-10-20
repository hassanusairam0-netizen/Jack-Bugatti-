import { curve, rise, window01 } from './util.js';

// ---------------------------------------------------------------------------
// The whole film is a pure function of scroll progress p ∈ [0, 1]. Scrolling
// backwards evaluates the same functions, so every state is reversible.
// ---------------------------------------------------------------------------
export const CHAPTERS = [
  { id: 'prologue', from: 0, num: '00', title: 'Prologue' },
  { id: 'exterior', from: 0.055, num: '01', title: 'The Exterior' },
  { id: 'exploded', from: 0.192, num: '01', title: 'Exploded View' },
  { id: 'engine', from: 0.325, num: '02', title: 'The Engine' },
  { id: 'power', from: 0.465, num: '03', title: 'Power Delivery' },
  { id: 'control', from: 0.572, num: '04', title: 'Control' },
  { id: 'structure', from: 0.672, num: '05', title: 'The Structure' },
  { id: 'cockpit', from: 0.748, num: '06', title: 'The Cockpit' },
  { id: 'assembly', from: 0.84, num: '—', title: 'The Reassembly' },
  { id: 'finale', from: 0.962, num: '—', title: 'The Art of Engineering' },
];
export const chapterAt = (p) => {
  let c = CHAPTERS[0];
  for (const ch of CHAPTERS) if (p >= ch.from) c = ch;
  return c;
};

// Camera: [p, azimuth°, elevation°, distance, target x, y, z, fov]
// Azimuth is unwrapped so the camera always travels the short, intended arc;
// the closing frame (393°) is the opening frame (33°) once round the car.
const CAM = [
  [0.0, 38, 4.5, 7.6, 0.15, 0.5, 0, 30],
  [0.045, 34, 5, 7.2, 0.15, 0.5, 0, 30],
  [0.08, 16, 3.5, 4.7, 1.75, 0.42, 0.12, 30],
  [0.108, 46, 1.6, 4.4, 1.9, 0.26, 0.28, 30],
  [0.14, 88, 4, 7.6, 0, 0.5, 0, 30],
  [0.17, 150, 9, 6.2, -1.7, 0.62, 0, 30],
  [0.195, 155, 16, 8.6, -0.5, 0.6, 0, 32],
  [0.25, 138, 23, 11.8, -0.1, 0.85, 0, 34],
  [0.315, 118, 26, 13.2, 0, 0.95, 0, 34],
  [0.35, 132, 18, 5.8, -0.88, 1.2, 0, 32],
  [0.385, 165, 32, 4.9, -0.9, 1.35, 0, 32],
  [0.415, 205, 20, 4.8, -0.95, 1.2, -0.1, 32],
  [0.44, 228, 18, 4.8, -1.6, 1.05, 0, 32],
  [0.462, 240, 22, 6.2, -1.2, 0.9, 0, 32],
  [0.5, 252, 34, 7.8, -0.1, 0.35, 0, 32],
  [0.54, 290, 30, 7.2, 0, 0.35, 0, 32],
  [0.565, 300, 22, 6.6, 0.6, 0.4, -0.4, 32],
  [0.6, 335, 10, 4.7, 1.36, 0.4, -1.5, 30],
  [0.64, 318, 7, 4.3, 1.36, 0.4, -1.5, 30],
  [0.665, 320, 20, 6.2, 1.0, 0.5, -1.0, 32],
  [0.7, 330, 42, 8.2, 0, 0.45, 0, 32],
  [0.735, 385, 38, 7.6, 0, 0.45, 0, 32],
  [0.762, 450, 54, 3.5, 0.25, 0.45, 0, 32],
  [0.786, 458, 48, 2.9, 0.3, 0.5, -0.1, 34],
  [0.81, 478, 36, 2.3, 0.45, 0.62, -0.3, 36],
  [0.83, 470, 38, 3.3, 0.3, 0.55, 0, 34],
  [0.86, 478, 26, 11.8, 0, 0.9, 0, 34],
  [0.905, 440, 16, 10.2, 0, 0.7, 0, 32],
  [0.95, 405, 7, 8.2, 0.1, 0.52, 0, 30],
  [0.975, 396, 4.5, 7.6, 0.15, 0.5, 0, 30],
  [1.0, 393, 4.5, 7.4, 0.15, 0.5, 0, 30],
];
const camCurves = [1, 2, 3, 4, 5, 6, 7].map((k) => curve(CAM.map((r) => [r[0], r[k]])));
export function cameraAt(p) {
  const [az, el, dist, tx, ty, tz, fov] = camCurves.map((f) => f(p));
  return { az, el, dist, tx, ty, tz, fov };
}

// Lighting: [p, environment, key, rim, focus spot, exposure]
const LIGHT = [
  [0, 1.0, 2.4, 3.0, 0, 1.0],
  [0.15, 1.0, 2.2, 3.2, 0, 1.0],
  [0.26, 0.82, 1.7, 3.6, 0, 0.98],
  [0.38, 0.62, 1.1, 3.0, 26, 1.0],
  [0.52, 0.78, 1.6, 3.0, 14, 1.0],
  [0.62, 0.95, 1.8, 3.0, 7, 1.0],
  [0.72, 0.85, 1.8, 3.4, 10, 1.0],
  [0.8, 1.1, 1.6, 2.4, 10, 1.02],
  [0.9, 0.62, 1.5, 5.5, 0, 0.96],
  [0.975, 1.05, 2.5, 4.6, 0, 1.04],
  [1, 1.05, 2.5, 4.6, 0, 1.04],
];
const lightCurves = [1, 2, 3, 4, 5].map((k) => curve(LIGHT.map((r) => [r[0], r[k]])));
export const lightsAt = (p) => lightCurves.map((f) => f(p));

// --- component choreography ---------------------------------------------
const EXPLODE_START = 0.198, EXPLODE_STEP = 0.0085, EXPLODE_DUR = 0.028;
const ASSEMBLE_START = 0.845, ASSEMBLE_STEP = 0.0062, ASSEMBLE_DUR = 0.022;
export const stageStart = (stage) => EXPLODE_START + (stage - 1) * EXPLODE_STEP;
export const orderStart = (order) => ASSEMBLE_START + (order - 1) * ASSEMBLE_STEP;
export const orderEnd = (order) => orderStart(order) + ASSEMBLE_DUR;

const MECH = ['corner', 'driveline', 'engine', 'exhaust', 'frame'];
const SHELL = ['body', 'aero', 'lights'];
export function chapterAmounts(p) {
  return {
    // from Power Delivery to The Structure the car is shown as an X-ray: the
    // mechanical package reassembles as a rolling chassis and the bodywork
    // returns to its exact position as a translucent shell
    rolling: window01(p, 0.462, 0.5, 0.742, 0.78),
    shellHome: window01(p, 0.462, 0.5, 0.75, 0.785),
    coolingHome: rise(p, 0.462, 0.5),
    shellGhost: window01(p, 0.49, 0.515, 0.742, 0.765),
    mechGhost: window01(p, 0.668, 0.69, 0.738, 0.758), // structure chapter: only the structure stays solid
    interior: Math.max(rise(p, 0.745, 0.776), window01(p, 0.462, 0.5, 0.75, 0.785)),
    engine: window01(p, 0.37, 0.4, 0.445, 0.468), // heads lift, turbos and intake open out
    drive: window01(p, 0.505, 0.53, 0.556, 0.58), // drivetrain separates slightly
    wheel: window01(p, 0.575, 0.612, 0.648, 0.675), // front-left corner exploded along its axle
  };
}
export const isShell = (part) => !part.tags.includes('interior') && part.tags.some((t) => SHELL.includes(t));
export const isStructure = (part) => part.tags.includes('structure');
export function explodeAmount(part, p, amt) {
  const s0 = stageStart(part.stage), r0 = orderStart(part.order);
  let e = rise(p, s0, s0 + EXPLODE_DUR) * (1 - rise(p, r0, r0 + ASSEMBLE_DUR));
  if (part.tags.some((t) => MECH.includes(t))) e *= 1 - amt.rolling;
  else if (part.tags.includes('interior')) e *= 1 - amt.interior;
  else if (part.tags.includes('cooling')) e *= 1 - amt.coolingHome; // radiators stay fitted once shown
  else if (!isStructure(part)) e *= 1 - amt.shellHome;
  return e;
}
export function ghostAmount(part, amt) {
  if (isStructure(part)) return 0;
  return isShell(part) ? amt.shellGhost : amt.mechGhost;
}

// --- annotations -------------------------------------------------------------
// Anchors are given in assembled car space and follow their component.
export const CALLOUTS = [
  { from: 0.066, to: 0.096, part: 'grille', at: [2.39, 0.36, 0], title: 'The Horseshoe Grille', text: 'A signature of the marque for nearly a century, framing the central cooling inlet.' },
  { from: 0.072, to: 0.1, part: 'headlightR', at: [2.02, 0.5, 0.66], title: 'Headlight Architecture', text: 'Four compact lighting units per side form a slim, precise signature.' },
  { from: 0.098, to: 0.124, part: 'splitter', at: [2.36, 0.12, 0.45], title: 'Aerodynamic Front Splitter', text: 'Designed to manage airflow around the front of the vehicle.' },
  { from: 0.104, to: 0.128, part: 'grille', at: [2.3, 0.24, 0.42], hl: false, title: 'Front Air Intakes', text: 'Generous inlets feed cooling air to the radiators and brakes.' },
  { from: 0.128, to: 0.152, part: 'doorR', at: [0.25, 0.62, 0.96], hl: false, title: 'Sculpted Bodywork', text: 'Form, airflow, and proportion brought together in one continuous design.' },
  { from: 0.136, to: 0.16, part: 'sideIntakeR', at: [-0.3, 0.42, 0.98], title: 'The Signature Curve', text: 'A sweeping C-shaped line divides the flank and frames the side air intake.' },
  { from: 0.154, to: 0.178, part: 'rearWing', at: [-1.65, 1.1, 0.55], title: 'Rear Wing', text: 'Raised for display — a large wing balances downforce and drag.' },
  { from: 0.162, to: 0.185, part: 'taillight', at: [-2.31, 0.62, 0.35], title: 'Light Blade', text: 'A single continuous light line spans the full width of the tail.' },
  { from: 0.168, to: 0.192, part: 'diffuser', at: [-2.25, 0.2, 0.35], title: 'Rear Diffuser', text: 'Accelerates the airflow beneath the car, helping press it into the road.' },

  { from: 0.338, to: 0.372, part: 'engine.block', at: [-0.88, 0.35, 0.28], title: 'W16 Architecture', text: 'Sixteen cylinders in four banks of four — effectively two narrow-angle V8s sharing one crankshaft.' },
  { from: 0.382, to: 0.41, part: 'engine.pistons', at: [-0.8, 0.62, 0.22], title: 'Cylinders & Pistons', text: 'Heads lifted to reveal the bores. Piston motion shown here is a representative visualisation.' },
  { from: 0.4, to: 0.428, part: 'engine.turbosL', at: [-0.88, 0.44, -0.42], title: 'The Turbocharging System', text: 'Compressed intake air helps deliver exceptional performance — four turbochargers in total.' },
  { from: 0.418, to: 0.444, part: 'radiatorSideL', at: [-0.32, 0.55, -0.8], title: 'Engine Cooling', text: 'Thermal management is essential when extraordinary power generates extraordinary heat.' },
  { from: 0.43, to: 0.458, part: 'transmission', at: [-1.55, 0.4, 0.18], title: 'The Transmission', text: 'Engine output is transferred through a high-performance drivetrain.' },

  { from: 0.49, to: 0.558, part: 'transmission', at: [-1.6, 0.42, 0.18], hl: false, title: 'Dual-Clutch Transmission', text: 'Seven ratios, pre-selected so each shift arrives without interruption.' },
  { from: 0.498, to: 0.558, part: 'halfshaftL', at: [-1.355, 0.36, -0.45], hl: false, title: 'Rear Half-Shafts', text: 'Carry torque from the differential out to each rear wheel.' },
  { from: 0.506, to: 0.56, part: 'propshaft', at: [0.1, 0.21, 0], hl: false, title: 'Propeller Shaft', text: 'Sends a share of the drive forward, so all four wheels can pull.' },
  { from: 0.514, to: 0.562, part: 'frontDiff', at: [1.33, 0.32, 0], hl: false, title: 'Front Axle Drive', text: 'Divides torque between the front wheels.' },

  { from: 0.603, to: 0.628, part: 'FL.tire', at: [1.355, 0.66, -0.86], sel: 'FL.tire', title: 'Performance Tyre', text: 'The only contact with the road — four patches, each roughly the size of a hand.' },
  { from: 0.612, to: 0.637, part: 'FL.disc', at: [1.355, 0.55, -0.72], sel: 'FL.disc', title: 'Carbon-Ceramic Disc', text: 'Light, heat-resistant and fade-free under repeated hard stops.' },
  { from: 0.621, to: 0.646, part: 'FL.caliper', at: [1.25, 0.52, -0.72], sel: 'FL.caliper', title: 'Monobloc Caliper', text: 'Multiple pistons clamp the disc evenly from both sides.' },
  { from: 0.63, to: 0.655, part: 'FL.damper', at: [1.32, 0.7, -0.5], sel: 'FL.damper', title: 'Spring & Damper', text: 'Controls body movement while keeping the tyre pressed to the surface.' },

  { from: 0.692, to: 0.742, part: 'monocoque', at: [0.2, 0.42, 0.62], title: 'Carbon Monocoque', text: 'A stiff, light carbon-fibre tub forms the safety cell around the occupants.' },
  { from: 0.698, to: 0.742, part: 'frontFrame', at: [1.8, 0.45, 0.45], title: 'Front Structure', text: 'Carries the front suspension and absorbs impact energy.' },
  { from: 0.704, to: 0.742, part: 'rearFrame', at: [-1.6, 0.66, 0.55], title: 'Rear Subframe', text: 'Holds engine, transmission and rear suspension to the tub.' },
  { from: 0.71, to: 0.742, part: 'mounts', at: [0.98, 0.55, -0.5], title: 'Mounting Points', text: 'Precisely located joints where body and mechanical systems meet the structure.' },

  { from: 0.776, to: 0.812, part: 'seatR', at: [-0.15, 0.62, 0.34], title: 'Hand-Stitched Seats', text: 'Full-grain leather, shaped and stitched by hand.' },
  { from: 0.784, to: 0.822, part: 'console', at: [0.42, 0.47, 0.02], title: 'The Centre Spine', text: 'A single sweep of machined aluminium divides the cabin.' },
  { from: 0.792, to: 0.828, part: 'steering', at: [0.36, 0.83, -0.36], title: 'Steering Wheel', text: 'Leather rim, aluminium spokes — the primary point of control.' },
  { from: 0.798, to: 0.83, part: 'cluster', at: [0.5, 0.86, -0.36], title: 'Instrument Cluster', text: 'Three dials, read at a glance.' },
  { from: 0.804, to: 0.832, part: 'pedals', at: [0.84, 0.36, -0.38], title: 'Pedals', text: 'Machined aluminium, placed precisely for the driver.' },
];

// Extra highlight groups for whole-system chapters (beyond callout parts).
export const HIGHLIGHTS = [
  { from: 0.49, to: 0.56, tags: ['driveline'], amount: 0.6 },
  { from: 0.69, to: 0.745, tags: ['mounts'], amount: 1 },
  { from: 0.418, to: 0.444, tags: ['cooling'], amount: 0.7 },
];

// Selectable components in the Control chapter.
export const SELECTABLE = [
  { key: 'FL.tire', title: 'Tyre', text: 'Wide, low-profile performance tyre. Its compound and construction are tuned for grip at very high speed.' },
  { key: 'FL.rim', title: 'Wheel', text: 'Forged alloy with ten twin spokes, light and stiff to reduce unsprung mass.' },
  { key: 'FL.disc', title: 'Brake Disc', text: 'Carbon-ceramic and cross-drilled — consistent under extreme heat.' },
  { key: 'FL.caliper', title: 'Caliper', text: 'A one-piece multi-piston caliper for even clamping force.' },
  { key: 'FL.upright', title: 'Upright & Hub', text: 'Carries the wheel bearing and links the corner to the suspension.' },
  { key: 'FL.arms', title: 'Wishbones', text: 'Upper and lower arms locate the wheel and control its camber as it moves.' },
  { key: 'FL.damper', title: 'Spring & Damper', text: 'The spring supports the car; the damper controls how quickly it moves.' },
  { key: 'FL.steer', title: 'Steering', text: 'The track rod turns the upright as the driver steers.' },
];

export const STAGES = [
  'Front & rear body panels', 'Bonnet & exterior panels', 'Doors & aerodynamics', 'Wheels & tyres',
  'Brake assemblies', 'Suspension & drive shafts', 'Cooling systems', 'Engine & transmission',
  'Exhaust', 'Carbon structure', 'Interior', 'Detail assemblies',
];
