# Bugatti — The Art of Engineering

A cinematic, scroll-driven 3D study of a Bugatti-inspired hypercar. Made by Jacob.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static site in dist/
npm run preview
```

## How it works

| File | Role |
| --- | --- |
| `src/body.js` | Parametric body loft `S(u, v)`. Every body panel is cut from this one surface, so panels meet exactly when assembled. |
| `src/car.js` | Builds about 90 separate components (panels, aero, lights, wheels, brakes, suspension, W16 engine, drivetrain, exhaust, cooling, structure, interior) and records each one's assembled transform. |
| `src/story.js` | The film as a pure function of scroll progress `p ∈ [0,1]`: chapters, camera path, lighting, explode/reassemble schedule, annotations. |
| `src/main.js` | Renderer, studio lighting, reflective floor, GSAP ScrollTrigger scrub, drag-to-rotate, X-ray shell, callouts, UI. |
| `src/materials.js`, `src/textures.js` | PBR materials and procedural canvas textures (carbon weave, honeycomb grille, leather, discs, gauges). No image assets. |
| `src/sound.js` | Optional synthesised sound (off by default). |

- **Exploded view**: each component interpolates between its assembled transform and an authored offset along a clear axis. Reassembly runs in a separate order: structure → interior → exhaust → engine → shafts → suspension → brakes → wheels → cooling → panels → bonnet → doors → lights → aero. Both directions return exactly to the stored transforms.
- **Chapters 03–05** show an X-ray: the mechanical package becomes a rolling chassis, and the bodywork returns to its exact position as a translucent shell.
- **Drag** orbits the camera around the current focus point. It does not alter component positions, and scrolling gradually restores the choreographed angle. Use **Reset view** to snap back. On touch screens only horizontal drags rotate the car, so vertical page scrolling still works.
- Respects `prefers-reduced-motion`. Falls back to a text message without WebGL. Lowers resolution automatically on slow GPUs.

## Honesty note

No licensed Bugatti 3D model with separable components was available, so the car is an **original, procedurally modelled Bugatti-inspired hypercar**. Its proportions follow the publicly known dimensions of the Chiron. The engine, drivetrain, chassis and interior are **representative visualisations, not factory geometry**, and the site says so where relevant. Technical claims are limited to widely published facts: an 8.0 L W16, four turbochargers, a seven-speed dual-clutch transmission, all-wheel drive and a carbon monocoque. Bugatti is a trademark of its owner. This is an independent, non-commercial tribute.
