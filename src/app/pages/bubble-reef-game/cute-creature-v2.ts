import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * createCuteCreature() v2 — "molded vinyl" procedural creatures.
 *
 * Where v1 (cute-creature.ts) composes squashed spheres, v2 abandons stacked
 * primitives for organic features entirely:
 *
 *  - Main body/head: highly segmented spheres/capsules (64 segments) with
 *    non-uniform "fleshy" scaling.
 *  - Every fin, limb, gill stalk, wing and tail: a smooth 2D silhouette drawn
 *    with `THREE.Shape` + bezier/quadratic curves, extruded thin via
 *    `THREE.ExtrudeGeometry` with a HEAVY bevel — then vertex-merged and
 *    re-normal'd so the bevel shades as one continuous molded surface
 *    (ExtrudeGeometry alone produces faceted bevels).
 *  - Anime eyes: nested flat `CircleGeometry` discs layered directly onto the
 *    body surface, oriented along the ellipsoid's true normal.
 *  - Seam sealing: extruded parts root slightly INSIDE their parent so the
 *    bevel forms the transition blend — no hard intersection lines.
 *
 * Extruded parts are modelled with their root at the shape origin and hung on
 * named pivot `Group`s, so `pivot.rotation` (or the sprite-baker's wiggle)
 * flaps them from their natural anchor.
 *
 * Creatures face +X to match the Bubble Reef sprite pipeline.
 */

export type CreatureV2Type =
  | 'axolotl'
  | 'manta'
  | 'crab'
  | 'penguin'
  | 'squid'
  | 'turtle'
  | 'fish'
  | 'puffer'
  | 'shrimp'
  | 'snail'
  | 'dolphin'
  | 'shark'
  | 'whale'
  | 'octopus'
  | 'lobster'
  | 'jellyfish'
  | 'starfish'
  | 'seal'
  | 'bluewhale'
  | 'mermaid'
  | 'plesiosaur'
  | 'grump';

export interface CuteCreatureV2Options {
  type?: CreatureV2Type;
  bodyColor?: string;
  bellyColor?: string;
  accentColor?: string;
  blushColor?: string;
  /** 'fish' only: paint clownfish-style white bands. */
  bands?: boolean;
}

const SEG = 64; // minimum segment count for all curved primary surfaces

// ------------------------------------------------------------------ helpers

/** Matte injection-molded vinyl. */
function vinyl(
  color: string,
  extra: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.7,
    metalness: 0.1,
    flatShading: false,
    ...extra,
  });
}

/** High-segment ellipsoid ("fleshy" non-uniform sphere). */
function flesh(
  parent: THREE.Object3D,
  color: string,
  radius: number,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  extra: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, SEG, SEG / 2), vinyl(color, extra));
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  parent.add(mesh);
  return mesh;
}

/**
 * Extrude a 2D silhouette into a puffy molded part. After extrusion the
 * geometry is vertex-merged and re-normal'd — THE critical step that turns
 * ExtrudeGeometry's faceted bevel into one continuous vinyl surface.
 */
function molded(shape: THREE.Shape, depth: number, puff = 1): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 24,
    bevelEnabled: true,
    bevelThickness: 0.15 * puff,
    bevelSize: 0.12 * puff,
    bevelSegments: 8,
  });
  geo = mergeVertices(geo, 1e-4);
  geo.computeVertexNormals();
  // native shape coordinates kept: the silhouette's origin stays at (0,0),
  // so a mesh mounted on a pivot rotates from its true anchor point
  geo.translate(0, 0, -depth / 2); // center only the thickness
  return geo;
}

/**
 * A tapered "petal" silhouette from the origin to (0, len): the universal
 * slender-fin/limb/gill profile. Pure bezier curves — no straight edges.
 */
function petalShape(len: number, width: number, lean = 0): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width, len * 0.18, width * 0.85 + lean, len * 0.78, lean, len);
  s.bezierCurveTo(-width * 0.85 + lean, len * 0.78, -width, len * 0.18, 0, 0);
  return s;
}

/**
 * Mount a molded extrusion at a named pivot: the geometry is recentered by
 * molded(), so we offset the mesh to put the shape's ROOT back on the pivot —
 * rotating the pivot then flaps the part from its anchor, and sinking the
 * pivot slightly into the parent body lets the bevel blend the seam away.
 */
function mountPetal(
  parent: THREE.Object3D,
  name: string,
  color: string,
  len: number,
  width: number,
  depth: number,
  at: [number, number, number],
  rotation: [number, number, number],
  opts: { lean?: number; puff?: number } = {},
): THREE.Group {
  const pivot = new THREE.Group();
  pivot.name = name;
  pivot.position.set(...at);
  pivot.rotation.set(...rotation);
  const mesh = new THREE.Mesh(molded(petalShape(len, width, opts.lean ?? 0), depth, opts.puff ?? 1), vinyl(color));
  pivot.add(mesh); // shape root is already at the pivot origin
  parent.add(pivot);
  return pivot;
}

/** Ellipsoid surface point + outward normal at spherical angles (θ around Y from +X, φ up). */
function onSurface(
  center: THREE.Vector3,
  radii: THREE.Vector3,
  theta: number,
  phi: number,
): { p: THREE.Vector3; n: THREE.Vector3 } {
  const d = new THREE.Vector3(
    Math.cos(phi) * Math.cos(theta),
    Math.sin(phi),
    Math.cos(phi) * Math.sin(theta),
  );
  const p = new THREE.Vector3(
    center.x + radii.x * d.x,
    center.y + radii.y * d.y,
    center.z + radii.z * d.z,
  );
  // ellipsoid normal ∝ (x/a², y/b², z/c²)
  const n = new THREE.Vector3(d.x / radii.x, d.y / radii.y, d.z / radii.z).normalize();
  return { p, n };
}

/**
 * Anime eye as NESTED FLAT DISCS laid on the body surface: big glossy dark
 * circle, large white highlight, small sparkle — each floated a hair above
 * the previous so there's zero z-fighting.
 */
function surfaceEye(
  parent: THREE.Object3D,
  center: THREE.Vector3,
  radii: THREE.Vector3,
  theta: number,
  phi: number,
  r: number,
): void {
  const { p, n } = onSurface(center, radii, theta, phi);
  const eye = new THREE.Mesh(
    new THREE.CircleGeometry(r, SEG),
    vinyl('#22252F', { roughness: 0.15, metalness: 0.05 }),
  );
  eye.position.copy(p).addScaledVector(n, 0.012);
  eye.lookAt(p.clone().add(n));
  eye.userData['noWiggle'] = true; // flat discs must never get the tail wiggle
  parent.add(eye);

  const hi = new THREE.Mesh(new THREE.CircleGeometry(r * 0.42, SEG), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hi.position.set(r * 0.28, r * 0.34, 0.008);
  hi.userData['noWiggle'] = true;
  eye.add(hi);

  const sparkle = new THREE.Mesh(new THREE.CircleGeometry(r * 0.16, SEG), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  sparkle.position.set(-r * 0.18, -r * 0.32, 0.008);
  sparkle.userData['noWiggle'] = true;
  eye.add(sparkle);
}

/** Flat blush disc on the surface. */
function surfaceBlush(
  parent: THREE.Object3D,
  color: string,
  center: THREE.Vector3,
  radii: THREE.Vector3,
  theta: number,
  phi: number,
  r: number,
): void {
  const { p, n } = onSurface(center, radii, theta, phi);
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, SEG),
    vinyl(color, { roughness: 0.85, transparent: true, opacity: 0.9 }),
  );
  m.position.copy(p).addScaledVector(n, 0.01);
  m.lookAt(p.clone().add(n));
  m.scale.y = 0.7; // soft oval
  m.userData['noWiggle'] = true;
  parent.add(m);
}

/** Gentle smile — a slim torus arc. faceX turns it toward +X for creatures
 *  posed facing the camera (otherwise it sits edge-on and reads as a dot). */
function smileArc(parent: THREE.Object3D, at: [number, number, number], r: number, arc = 1.6, faceX = false): void {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.14, 12, 32, arc), vinyl('#22252F', { roughness: 0.4 }));
  m.position.set(...at);
  m.rotation.set(0, faceX ? Math.PI / 2 : 0, 1.5 * Math.PI - arc / 2);
  parent.add(m);
}

// ------------------------------------------------------------- the creature

export function createCuteCreature(options: CuteCreatureV2Options = {}): THREE.Group {
  switch (options.type ?? 'axolotl') {
    case 'manta':
      return buildManta(options);
    case 'crab':
      return buildCrab(options);
    case 'penguin':
      return buildPenguin(options);
    case 'squid':
      return buildSquid(options);
    case 'turtle':
      return buildTurtle(options);
    case 'fish':
      return buildFish(options);
    case 'puffer':
      return buildPuffer(options);
    case 'shrimp':
      return buildShrimp(options);
    case 'snail':
      return buildSnail(options);
    case 'dolphin':
      return buildDolphin(options);
    case 'shark':
      return buildShark(options);
    case 'whale':
      return buildWhale(options);
    case 'octopus':
      return buildOctopus(options);
    case 'lobster':
      return buildLobster(options);
    case 'jellyfish':
      return buildJellyfish(options);
    case 'starfish':
      return buildStarfish(options);
    case 'seal':
      return buildSeal(options);
    case 'bluewhale':
      return buildBlueWhale(options);
    case 'mermaid':
      return buildMermaid(options);
    case 'plesiosaur':
      return buildPlesiosaur(options);
    case 'grump':
      return buildGrump(options);
    default:
      return buildAxolotl(options);
  }
}

// ---------------------------------------------------------------- axolotl

function buildAxolotl(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#FFB7C5'; // soft bubblegum pink
  const belly = o.bellyColor ?? '#FFE4EB';
  const accent = o.accentColor ?? '#FF7F9C'; // gill coral
  const blush = o.blushColor ?? '#FF97AE';

  const g = new THREE.Group();
  g.name = 'cute-axolotl-v2';

  // oversized chibi head+torso — one fleshy mass, no neck seam
  const headC = new THREE.Vector3(0.3, 0, 0);
  const headR = new THREE.Vector3(0.88, 0.78, 0.78);
  flesh(g, body, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);
  flesh(g, body, 0.62, [-0.62, -0.06, 0], [1.35, 0.82, 0.8]); // tapering torso
  flesh(g, belly, 0.6, [-0.35, -0.22, 0], [1.7, 0.55, 0.72]); // soft belly

  // tail: one slender vertical blade, bevel-blended into the torso
  mountPetal(g, 'tail', body, 1.05, 0.34, 0.05, [-1.28, 0.02, 0], [0, 0, Math.PI / 2 + 0.12], { lean: -0.16, puff: 0.9 });

  // the signature gill stalks — three molded fronds per side, fanned like
  // antlers: rooted at the head's rear-top sides, sweeping up-and-out
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 3; i++) {
      mountPetal(
        g,
        `gill${side > 0 ? 'L' : 'R'}${i}`,
        accent,
        0.52 - i * 0.06,
        0.12 - i * 0.015,
        0.03,
        [0.38 - i * 0.22, 0.4 + i * 0.06, side * 0.52],
        // x-rot tips the blade toward ±Z (outward); z-rot fans it backward
        [side * 0.85, 0, -0.15 - i * 0.35],
        { puff: 0.55 },
      );
    }
  }

  // four stubby molded legs
  for (const side of [1, -1] as const) {
    mountPetal(g, `legF${side}`, body, 0.3, 0.11, 0.05, [0.32, -0.62, side * 0.4], [side * 0.35, 0, Math.PI - 0.25], { puff: 0.6 });
    mountPetal(g, `legB${side}`, body, 0.28, 0.1, 0.05, [-0.62, -0.52, side * 0.38], [side * 0.35, 0, Math.PI + 0.2], { puff: 0.6 });
  }

  // face — wide-set, low, oversized
  surfaceEye(g, headC, headR, 0.62, 0.02, 0.2);
  surfaceEye(g, headC, headR, -0.62, 0.02, 0.2);
  surfaceBlush(g, blush, headC, headR, 0.78, -0.3, 0.12);
  surfaceBlush(g, blush, headC, headR, -0.78, -0.3, 0.12);
  smileArc(g, [1.16, -0.18, 0.1], 0.1, 1.8);

  return g;
}

// ------------------------------------------------------------------ manta

function buildManta(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#9FE0CD'; // pastel mint
  const belly = o.bellyColor ?? '#F0FBF7';
  const accent = o.accentColor ?? '#7CCBB4';
  const blush = o.blushColor ?? '#FFA9BC';

  const g = new THREE.Group();
  g.name = 'cute-manta-v2';

  // wide fleshy disc body
  const bodyC = new THREE.Vector3(0.12, 0, 0);
  const bodyR = new THREE.Vector3(1.05, 0.52, 0.85);
  flesh(g, body, 1, [bodyC.x, bodyC.y, bodyC.z], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.95, [0.18, -0.12, 0], [1.02, 0.42, 0.8]);

  // wings: sweeping bezier silhouettes, extruded thin + heavily beveled.
  // Shape space: +Y = outward span, -X = backward sweep.
  const wingShape = (): THREE.Shape => {
    const s = new THREE.Shape();
    s.moveTo(0.3, 0);
    s.bezierCurveTo(0.34, 0.5, 0.1, 1.05, -0.42, 1.5); // leading edge → tip
    s.bezierCurveTo(-0.5, 1.18, -0.62, 0.62, -0.7, 0.12); // tip → trailing edge
    s.bezierCurveTo(-0.45, -0.06, -0.2, -0.08, 0.3, 0); // smooth root return
    return s;
  };
  for (const side of [1, -1] as const) {
    const pivot = new THREE.Group();
    pivot.name = side > 0 ? 'wingL' : 'wingR';
    pivot.position.set(0.05, 0.05, side * 0.42); // rooted inside the body
    // near-flat glide, wings scaled up so the span dominates the silhouette
    pivot.rotation.x = side * 0.08;
    pivot.scale.setScalar(1.18);
    const mesh = new THREE.Mesh(molded(wingShape(), 0.05, 0.9), vinyl(body));
    // lay the shape flat: +Y (span) → ±Z outward, extrusion → vertical
    mesh.rotation.x = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    pivot.add(mesh);
    g.add(pivot);
  }

  // slender whip tail
  mountPetal(g, 'tail', accent, 1.2, 0.13, 0.03, [-0.95, 0.08, 0], [0, 0, Math.PI / 2 + 0.1], { lean: 0.14, puff: 0.55 });

  // cephalic lobes — two cute curled nubs at the front
  for (const side of [1, -1] as const) {
    mountPetal(g, `lobe${side}`, accent, 0.3, 0.1, 0.05, [0.95, -0.08, side * 0.34], [side * 0.5, 0, -Math.PI / 2 + 0.35], { puff: 0.55 });
  }

  // face — wide apart on the upper-front curve (visible in the banked pose)
  surfaceEye(g, bodyC, bodyR, 0.55, 0.35, 0.19);
  surfaceEye(g, bodyC, bodyR, -0.55, 0.35, 0.19);
  surfaceBlush(g, blush, bodyC, bodyR, 0.8, 0.12, 0.11);
  surfaceBlush(g, blush, bodyC, bodyR, -0.8, 0.12, 0.11);
  smileArc(g, [1.12, 0.02, 0.2], 0.09, 1.7);

  // bank the glide toward the viewer so the wingspan + face read clearly
  g.rotation.x = 0.6;
  g.rotation.y = -0.38;

  return g;
}

// ------------------------------------------------------------------- crab

/** A chunky rounded pincer: one continuous bezier silhouette with a notch. */
function clawShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, -0.12);
  s.bezierCurveTo(0.32, -0.3, 0.66, -0.2, 0.74, 0.02); // lower thumb → tip
  s.bezierCurveTo(0.66, 0.08, 0.56, 0.1, 0.46, 0.1); // notch bites inward
  s.bezierCurveTo(0.64, 0.26, 0.54, 0.52, 0.3, 0.56); // big upper lobe
  s.bezierCurveTo(0.04, 0.6, -0.16, 0.38, -0.13, 0.14); // rounded back
  s.bezierCurveTo(-0.11, -0.02, -0.06, -0.09, 0, -0.12); // wrist
  return s;
}

function buildCrab(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#FF8A78'; // smooth coral
  const belly = o.bellyColor ?? '#FFD9CE';
  const accent = o.accentColor ?? '#F2664F';
  const blush = o.blushColor ?? '#FFB4A4';

  const g = new THREE.Group();
  g.name = 'cute-crab-v2';

  // wide fleshy shell body
  const bodyC = new THREE.Vector3(0, 0, 0);
  const bodyR = new THREE.Vector3(0.95, 0.72, 1.1); // widest across Z (side-to-side)
  flesh(g, body, 1, [0, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.92, [0.08, -0.2, 0], [0.92, 0.55, 1.02]);

  // pincers: molded claw silhouettes raised beside the body
  for (const side of [1, -1] as const) {
    const shoulder = new THREE.Group();
    shoulder.name = side > 0 ? 'clawL' : 'clawR';
    shoulder.position.set(0.25, 0.05, side * 0.95);
    // slim arm reaching up-and-out
    mountPetal(shoulder, `arm${side}`, accent, 0.42, 0.11, 0.06, [0, 0, 0], [side * 0.55, 0, side * -0.15], { puff: 0.55 });
    const claw = new THREE.Mesh(molded(clawShape(), 0.09, 0.8), vinyl(body));
    claw.position.set(-0.05, 0.42, side * 0.28);
    claw.rotation.set(side * 0.35, side * -0.5, 0.15);
    claw.scale.setScalar(0.9);
    shoulder.add(claw);
    g.add(shoulder);
  }

  // three slender legs per side, curving down-and-out
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 3; i++) {
      mountPetal(
        g,
        `leg${side}${i}`,
        accent,
        0.4 - i * 0.04,
        0.08,
        0.05,
        [-0.15 - i * 0.22, -0.38, side * (0.85 - i * 0.08)],
        [side * (2.25 + i * 0.18), 0, i * 0.12],
        { lean: side * 0.08, puff: 0.5 },
      );
    }
  }

  // face on the upper-front shell
  surfaceEye(g, bodyC, bodyR, 0.3, 0.3, 0.2);
  surfaceEye(g, bodyC, bodyR, -0.3, 0.3, 0.2);
  surfaceBlush(g, blush, bodyC, bodyR, 0.52, 0.02, 0.12);
  surfaceBlush(g, blush, bodyC, bodyR, -0.52, 0.02, 0.12);
  smileArc(g, [0.98, -0.06, 0], 0.1, 1.7, true);

  // crabs walk sideways — face the camera, claws spread across the frame
  g.rotation.y = -1.0;
  return g;
}

// ---------------------------------------------------------------- penguin

/** A puffy bib/belly shield that hugs the chest, bevel-blended at the rim. */
function bibShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0.52);
  s.bezierCurveTo(0.4, 0.5, 0.52, 0.15, 0.5, -0.18);
  s.bezierCurveTo(0.48, -0.52, 0.22, -0.72, 0, -0.72);
  s.bezierCurveTo(-0.22, -0.72, -0.48, -0.52, -0.5, -0.18);
  s.bezierCurveTo(-0.52, 0.15, -0.4, 0.5, 0, 0.52);
  return s;
}

function buildPenguin(o: CuteCreatureV2Options): THREE.Group {
  const dark = o.bodyColor ?? '#3C5068'; // slate navy hood + back
  const white = o.bellyColor ?? '#FFFFFF';
  const accent = o.accentColor ?? '#FFB347'; // beak + feet
  const blush = o.blushColor ?? '#F5A9BC';

  const g = new THREE.Group();
  g.name = 'cute-penguin-v2';

  // one upright egg: the dark shell is the whole silhouette
  flesh(g, dark, 0.8, [0, 0, 0], [0.82, 1.05, 0.88]);

  // the classic penguin white: ONE continuous face+belly oval, a smooth
  // ellipsoid bulging slightly proud of the egg's front — the dark reads
  // as a hood around it instead of the two-part "plate on a ball" look
  const whiteC = new THREE.Vector3(0.28, -0.08, 0);
  const whiteR = new THREE.Vector3(0.48, 0.72, 0.56);
  flesh(g, white, 0.78, [whiteC.x, whiteC.y, whiteC.z], [0.62, 0.92, 0.72]);

  // face lives ON the white oval (dark-on-white = instantly readable)
  surfaceEye(g, whiteC, whiteR, 0.42, 0.42, 0.17);
  surfaceEye(g, whiteC, whiteR, -0.42, 0.42, 0.17);
  surfaceBlush(g, blush, whiteC, whiteR, 0.72, 0.1, 0.09);
  surfaceBlush(g, blush, whiteC, whiteR, -0.72, 0.1, 0.09);
  // little molded beak between-and-below the eyes
  mountPetal(g, 'beak', accent, 0.24, 0.12, 0.06, [0.68, 0.14, 0], [0, 0, -Math.PI / 2 - 0.22], { puff: 0.5 });

  // slim flipper wings hugging the sides
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'wingL' : 'wingR', dark, 0.62, 0.17, 0.06, [0.02, 0.18, side * 0.7], [side * 0.28, 0, Math.PI - side * 0.32], { lean: side * 0.05, puff: 0.55 });
  }

  // splayed orange feet poking out at the bottom front
  for (const side of [1, -1] as const) {
    mountPetal(g, `foot${side}`, accent, 0.34, 0.16, 0.07, [0.42, -0.86, side * 0.28], [side * 0.5, 0, -Math.PI / 2 - 0.28], { puff: 0.55 });
  }

  // stubby tail + a tiny crown tuft
  mountPetal(g, 'tail', dark, 0.28, 0.13, 0.06, [-0.66, -0.5, 0], [0, 0, 2.35], { puff: 0.5 });
  mountPetal(g, 'tuft', dark, 0.18, 0.05, 0.04, [0.02, 0.82, 0], [0, 0, 0.2], { puff: 0.4 });

  // face the camera (waddle-forward pose)
  g.rotation.y = -0.9;
  return g;
}

// ------------------------------------------------------------------ squid

function buildSquid(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#FF9DBE';
  const belly = o.bellyColor ?? '#FFD9E5';
  const accent = o.accentColor ?? '#F272A0';
  const blush = o.blushColor ?? '#FF7FA6';

  const g = new THREE.Group();
  g.name = 'cute-squid-v2';

  // upright chibi mantle — one big fleshy egg, face-forward
  const bodyC = new THREE.Vector3(0, 0.1, 0);
  const bodyR = new THREE.Vector3(0.85, 1.05, 0.85);
  flesh(g, body, 1, [0, 0.1, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.78, [0.2, -0.18, 0], [0.72, 0.72, 0.76]); // soft face/tummy glow

  // two molded "ear" fins near the mantle tip, swept up-and-out
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.62, 0.2, 0.06, [-0.12, 0.82, side * 0.42], [side * 0.75, 0, side * -0.22], { lean: side * 0.1, puff: 0.7 });
  }

  // a skirt of tentacle petals around the bottom rim, splayed well clear
  // of the mantle so they read from the front
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const x = Math.cos(a) * 0.5;
    const z = Math.sin(a) * 0.5;
    mountPetal(
      g,
      `arm${i}`,
      accent,
      0.58 + (i % 2) * 0.12,
      0.13,
      0.05,
      [x, -0.86, z],
      // hang downward, curling outward from the rim
      [Math.sin(a) * 0.8, 0, Math.PI - Math.cos(a) * 0.8 + (i % 2 ? 0.16 : -0.12)],
      { lean: (i % 2 ? 1 : -1) * 0.1, puff: 0.55 },
    );
  }

  // face — big, wide, low on the mantle front
  surfaceEye(g, bodyC, bodyR, 0.34, 0.12, 0.22);
  surfaceEye(g, bodyC, bodyR, -0.34, 0.12, 0.22);
  surfaceBlush(g, blush, bodyC, bodyR, 0.58, -0.14, 0.12);
  surfaceBlush(g, blush, bodyC, bodyR, -0.58, -0.14, 0.12);
  smileArc(g, [0.86, -0.24, 0], 0.09, 1.7, true);

  // face the camera
  g.rotation.y = -0.95;
  return g;
}

// ----------------------------------------------------------------- turtle

function buildTurtle(o: CuteCreatureV2Options): THREE.Group {
  const shell = o.bodyColor ?? '#4CBE93';
  const shellTop = o.accentColor ?? '#3AA57E';
  const rim = '#CDEFC4';
  const skin = o.bellyColor ?? '#A5E3BC';
  const blush = o.blushColor ?? '#FF9FB6';

  const g = new THREE.Group();
  g.name = 'cute-turtle-v2';

  // domed shell: fleshy dome + darker top plate + pale rim
  flesh(g, shell, 0.82, [-0.15, 0.18, 0], [1.05, 0.66, 1.0]);
  flesh(g, shellTop, 0.8, [-0.15, 0.26, 0], [0.88, 0.55, 0.84]);
  flesh(g, rim, 0.8, [-0.15, -0.02, 0], [1.14, 0.26, 1.08]);

  // big chibi head, poking out front
  const headC = new THREE.Vector3(0.78, 0.12, 0);
  const headR = new THREE.Vector3(0.46, 0.44, 0.44);
  flesh(g, skin, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);

  // molded flippers — front pair sweeping forward-out like a swim stroke
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'finL' : 'finR', skin, 0.68, 0.19, 0.07, [0.32, -0.18, side * 0.7], [side * 1.35, side * -0.3, -1.15], { lean: side * 0.12, puff: 0.65 });
    mountPetal(g, `finB${side}`, skin, 0.42, 0.14, 0.06, [-0.82, -0.18, side * 0.52], [side * 1.5, 0, 2.35], { lean: side * 0.08, puff: 0.55 });
  }
  // tiny tail
  mountPetal(g, 'tail', skin, 0.22, 0.09, 0.05, [-1.05, -0.05, 0], [0, 0, 1.9], { puff: 0.5 });

  // face on the head sphere
  surfaceEye(g, headC, headR, 0.42, 0.18, 0.13);
  surfaceEye(g, headC, headR, -0.42, 0.18, 0.13);
  surfaceBlush(g, blush, headC, headR, 0.68, -0.18, 0.08);
  surfaceBlush(g, blush, headC, headR, -0.68, -0.18, 0.08);
  smileArc(g, [1.22, -0.04, 0.05], 0.07, 1.7);

  // 3/4 swim pose: shell readable, face toward the camera
  g.rotation.y = -0.55;
  return g;
}

// ------------------------------------------------------------------- fish

function buildFish(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#F79BB0';
  const belly = o.bellyColor ?? '#FFEDF2';
  const accent = o.accentColor ?? '#EF7D99';
  const blush = o.blushColor ?? '#FF8FAB';

  const g = new THREE.Group();
  g.name = 'cute-fish-v2';

  const bodyC = new THREE.Vector3(0, 0, 0);
  const bodyR = new THREE.Vector3(1.0, 0.92, 0.82);
  flesh(g, body, 1, [0, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.92, [0.08, -0.14, 0], [0.94, 0.78, 0.76]);
  if (o.bands) {
    flesh(g, '#FFFFFF', 1, [0.34, 0, 0], [0.17, 0.945, 0.84]);
    flesh(g, '#FFFFFF', 1, [-0.52, 0.02, 0], [0.13, 0.8, 0.74]);
  }
  // puckered lips
  flesh(g, belly, 0.16, [0.97, -0.06, 0], [0.5, 0.38, 0.55]);

  // heart-fan tail: two molded petals sweeping back-up and back-down
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.95, 0.02, 0);
  g.add(tail);
  mountPetal(tail, 'tailUp', accent, 0.58, 0.2, 0.06, [0, 0, 0], [0, 0, 1.12], { lean: 0.08, puff: 0.65 });
  mountPetal(tail, 'tailDn', accent, 0.58, 0.2, 0.06, [0, 0, 0], [0, 0, 2.0], { lean: -0.08, puff: 0.65 });

  // dorsal + pectorals
  mountPetal(g, 'dorsal', accent, 0.5, 0.18, 0.06, [-0.18, 0.82, 0], [0, 0, 0.55], { lean: -0.1, puff: 0.6 });
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.34, 0.12, 0.05, [0.22, -0.28, side * 0.68], [side * 1.05, 0, -1.25], { puff: 0.5 });
  }

  surfaceEye(g, bodyC, bodyR, 0.52, 0.12, 0.2);
  surfaceEye(g, bodyC, bodyR, -0.52, 0.12, 0.2);
  surfaceBlush(g, blush, bodyC, bodyR, 0.74, -0.2, 0.11);
  surfaceBlush(g, blush, bodyC, bodyR, -0.74, -0.2, 0.11);
  smileArc(g, [0.9, -0.26, 0.3], 0.07, 1.7);

  g.rotation.y = -0.35;
  return g;
}

// ------------------------------------------------------------------ puffer

function buildPuffer(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#FFD36E';
  const belly = o.bellyColor ?? '#FFF3CD';
  const accent = o.accentColor ?? '#F0A94C';
  const blush = o.blushColor ?? '#FFAD85';

  const g = new THREE.Group();
  g.name = 'cute-puffer-v2';

  const bodyC = new THREE.Vector3(0, 0, 0);
  const bodyR = new THREE.Vector3(1.0, 0.96, 0.96);
  flesh(g, body, 1, [0, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.9, [0.16, -0.16, 0], [0.84, 0.74, 0.84]);

  // soft molded spikes — petals aligned to the surface normal, face kept clear
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 14; i++) {
    const gr = (1 + Math.sqrt(5)) / 2;
    const y = 1 - ((i + 0.5) / 14) * 2;
    const rr = Math.sqrt(1 - y * y);
    const a = (2 * Math.PI * i) / gr;
    const dir = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    if (dir.x > 0.4) continue; // face stays smooth
    const spike = mountPetal(g, `spike${i}`, accent, 0.3, 0.12, 0.05, [dir.x * bodyR.x * 0.95, dir.y * bodyR.y * 0.95, dir.z * bodyR.z * 0.95], [0, 0, 0], { puff: 0.45 });
    spike.quaternion.setFromUnitVectors(up, dir);
  }

  // little fins + tail
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.3, 0.11, 0.05, [0.2, -0.3, side * 0.8], [side * 1.1, 0, -1.3], { puff: 0.45 });
  }
  mountPetal(g, 'tail', accent, 0.4, 0.16, 0.05, [-0.95, 0.02, 0], [0, 0, 1.55], { lean: 0.06, puff: 0.55 });

  surfaceEye(g, bodyC, bodyR, 0.36, 0.14, 0.24);
  surfaceEye(g, bodyC, bodyR, -0.36, 0.14, 0.24);
  surfaceBlush(g, blush, bodyC, bodyR, 0.6, -0.14, 0.13);
  surfaceBlush(g, blush, bodyC, bodyR, -0.6, -0.14, 0.13);
  smileArc(g, [0.94, -0.2, 0], 0.09, 1.7, true);

  g.rotation.y = -0.95; // proud round face to the camera
  return g;
}

// ------------------------------------------------------------------ shrimp

function buildShrimp(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#FFB99E';
  const belly = o.bellyColor ?? '#FFDCCB';
  const accent = o.accentColor ?? '#FF9478';
  const blush = o.blushColor ?? '#FF8E75';

  const g = new THREE.Group();
  g.name = 'cute-shrimp-v2';

  // big chibi head
  const headC = new THREE.Vector3(0.45, 0.15, 0);
  const headR = new THREE.Vector3(0.55, 0.52, 0.5);
  flesh(g, body, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);
  flesh(g, belly, 0.44, [0.62, -0.02, 0], [0.9, 0.72, 0.85]);

  // curling body segments, shrinking up and back
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.05, 0.05, 0);
  g.add(tail);
  flesh(tail, body, 0.4, [-0.1, 0, 0], [1.05, 0.85, 0.8]);
  flesh(tail, body, 0.3, [-0.52, 0.16, 0], [0.95, 0.85, 0.75]);
  flesh(tail, body, 0.22, [-0.8, 0.42, 0], [0.9, 0.85, 0.7]);
  mountPetal(tail, 'fan', accent, 0.44, 0.19, 0.05, [-0.92, 0.58, 0], [0, 0, 2.35], { lean: -0.1, puff: 0.6 });

  // long curved antennae
  for (const zs of [0.1, -0.1]) {
    mountPetal(g, `antenna${zs > 0 ? 'L' : 'R'}`, accent, 0.62, 0.05, 0.03, [0.72, 0.55, zs], [zs * 3, 0, -0.55], { lean: 0.14, puff: 0.35 });
  }
  // tiny swimming legs
  for (let i = 0; i < 3; i++) {
    mountPetal(g, `leg${i}`, accent, 0.2, 0.06, 0.04, [0.35 - i * 0.28, -0.38, 0.08], [0.25, 0, Math.PI - 0.35 + i * 0.22], { puff: 0.4 });
  }

  surfaceEye(g, headC, headR, 0.5, 0.15, 0.16);
  surfaceEye(g, headC, headR, -0.5, 0.15, 0.16);
  surfaceBlush(g, blush, headC, headR, 0.72, -0.15, 0.09);
  surfaceBlush(g, blush, headC, headR, -0.72, -0.15, 0.09);
  smileArc(g, [0.98, -0.05, 0.2], 0.06, 1.7);

  g.rotation.y = -0.45;
  return g;
}

// ------------------------------------------------------------------- snail

function buildSnail(o: CuteCreatureV2Options): THREE.Group {
  const skin = o.bodyColor ?? '#FFDCAF';
  const shellA = o.accentColor ?? '#C9A6FF';
  const shellB = '#B78EF7';
  const shellC2 = '#A678EB';
  const blush = o.blushColor ?? '#FFA9BC';

  const g = new THREE.Group();
  g.name = 'cute-snail-v2';

  // soft foot + round head
  flesh(g, skin, 0.45, [0.15, -0.5, 0], [1.5, 0.45, 0.7]);
  const headC = new THREE.Vector3(0.72, -0.15, 0);
  const headR = new THREE.Vector3(0.36, 0.36, 0.34);
  flesh(g, skin, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);

  // chunky stepped-swirl shell, swirl steps offset toward the camera side
  flesh(g, shellA, 0.58, [-0.32, 0.14, 0], [1, 1, 0.9]);
  flesh(g, shellB, 0.38, [-0.26, 0.2, 0.26]);
  flesh(g, shellC2, 0.2, [-0.2, 0.26, 0.45]);

  // eye stalks: slim petals with little eye-balls on top
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'stalkL' : 'stalkR', skin, 0.36, 0.055, 0.04, [0.78, 0.05, side * 0.12], [side * 0.12, 0, -0.25], { puff: 0.4 });
    const tipC = new THREE.Vector3(0.87, 0.4, side * 0.13);
    const tipR = new THREE.Vector3(0.12, 0.12, 0.12);
    flesh(g, skin, 1, [tipC.x, tipC.y, tipC.z], [tipR.x, tipR.y, tipR.z]);
    surfaceEye(g, tipC, tipR, side * 0.45, 0.1, 0.085);
  }

  surfaceBlush(g, blush, headC, headR, 0.7, -0.25, 0.07);
  surfaceBlush(g, blush, headC, headR, -0.7, -0.25, 0.07);
  smileArc(g, [1.02, -0.22, 0.12], 0.06, 1.7);

  g.rotation.y = -0.55;
  return g;
}

// ----------------------------------------------------------------- dolphin

function buildDolphin(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#70B9E8';
  const belly = o.bellyColor ?? '#EAF7FF';
  const accent = o.accentColor ?? '#5AA6DB';
  const blush = o.blushColor ?? '#FFB3C7';

  const g = new THREE.Group();
  g.name = 'cute-dolphin-v2';

  const bodyC = new THREE.Vector3(0, 0, 0);
  const bodyR = new THREE.Vector3(1.2, 0.92, 0.85);
  flesh(g, body, 1, [0, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.92, [0.08, -0.16, 0], [1.12, 0.74, 0.8]);
  // rounded chibi snout
  flesh(g, body, 0.34, [1.12, -0.14, 0], [1.15, 0.6, 0.76]);
  flesh(g, belly, 0.3, [1.14, -0.22, 0], [1.08, 0.48, 0.68]);

  mountPetal(g, 'dorsal', accent, 0.55, 0.19, 0.06, [-0.18, 0.8, 0], [0, 0, 0.62], { lean: -0.12, puff: 0.65 });
  // horizontal flukes
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-1.12, 0.06, 0);
  g.add(tail);
  flesh(tail, body, 0.2, [-0.05, 0, 0], [1.15, 0.72, 0.68]);
  for (const side of [1, -1] as const) {
    mountPetal(tail, `fluke${side}`, accent, 0.5, 0.17, 0.05, [-0.2, 0.02, 0], [side * 1.2, 0, 0.5], { lean: side * 0.1, puff: 0.55 });
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.38, 0.13, 0.05, [0.28, -0.32, side * 0.66], [side * 1.05, 0, -1.35], { puff: 0.5 });
  }

  surfaceEye(g, bodyC, bodyR, 0.5, 0.12, 0.17);
  surfaceEye(g, bodyC, bodyR, -0.5, 0.12, 0.17);
  surfaceBlush(g, blush, bodyC, bodyR, 0.7, -0.14, 0.1);
  surfaceBlush(g, blush, bodyC, bodyR, -0.7, -0.14, 0.1);
  smileArc(g, [1.38, -0.18, 0.18], 0.08, 1.8);

  g.rotation.y = -0.35;
  return g;
}

// ------------------------------------------------------------------- shark

function buildShark(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#84A7C0';
  const belly = o.bellyColor ?? '#E9F2F8';
  const accent = o.accentColor ?? '#6F94AD';
  const blush = o.blushColor ?? '#F5A9BC';

  const g = new THREE.Group();
  g.name = 'cute-shark-v2';

  const bodyC = new THREE.Vector3(0, 0, 0);
  const bodyR = new THREE.Vector3(1.35, 0.9, 0.82);
  flesh(g, body, 1, [0, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.92, [0.1, -0.2, 0], [1.28, 0.68, 0.76]);

  // THE fin
  mountPetal(g, 'dorsal', accent, 0.62, 0.22, 0.07, [-0.15, 0.82, 0], [0, 0, 0.55], { lean: -0.16, puff: 0.7 });
  // vertical shark tail: big upper lobe, small lower
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-1.28, 0.05, 0);
  g.add(tail);
  flesh(tail, body, 0.2, [-0.02, 0, 0], [1.1, 0.7, 0.65]);
  mountPetal(tail, 'lobeUp', accent, 0.55, 0.18, 0.06, [-0.12, 0.02, 0], [0, 0, 1.05], { lean: 0.1, puff: 0.6 });
  mountPetal(tail, 'lobeDn', accent, 0.36, 0.14, 0.05, [-0.1, -0.02, 0], [0, 0, 2.1], { lean: -0.06, puff: 0.5 });
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.42, 0.15, 0.05, [0.3, -0.35, side * 0.62], [side * 1.1, 0, -1.4], { puff: 0.55 });
  }

  surfaceEye(g, bodyC, bodyR, 0.48, 0.16, 0.18);
  surfaceEye(g, bodyC, bodyR, -0.48, 0.16, 0.18);
  surfaceBlush(g, blush, bodyC, bodyR, 0.68, -0.1, 0.1);
  surfaceBlush(g, blush, bodyC, bodyR, -0.68, -0.1, 0.1);
  // friendly grin + two rounded teeth
  smileArc(g, [1.18, -0.22, 0.32], 0.12, 1.9);
  flesh(g, '#FFFFFF', 0.05, [1.22, -0.32, 0.3], [0.85, 1.15, 0.7]);
  flesh(g, '#FFFFFF', 0.05, [1.1, -0.35, 0.44], [0.85, 1.15, 0.7]);

  g.rotation.y = -0.35;
  return g;
}

// ------------------------------------------------------------------- whale

function buildWhale(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#79AFDE';
  const belly = o.bellyColor ?? '#D7E9F8';
  const accent = o.accentColor ?? '#6499CB';
  const blush = o.blushColor ?? '#FFB3C7';

  const g = new THREE.Group();
  g.name = 'cute-whale-v2';

  const bodyC = new THREE.Vector3(0, 0, 0);
  const bodyR = new THREE.Vector3(1.28, 1.0, 0.95);
  flesh(g, body, 1, [0, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.94, [0.1, -0.26, 0], [1.2, 0.74, 0.88]);

  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-1.2, 0.12, 0);
  g.add(tail);
  flesh(tail, body, 0.22, [-0.04, 0, 0], [1.15, 0.72, 0.68]);
  for (const side of [1, -1] as const) {
    mountPetal(tail, `fluke${side}`, accent, 0.5, 0.18, 0.05, [-0.2, 0.05, 0], [side * 1.2, 0, 0.55], { lean: side * 0.1, puff: 0.55 });
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.4, 0.14, 0.05, [0.28, -0.42, side * 0.68], [side * 1.15, 0, -1.45], { puff: 0.5 });
  }

  // spout: slim molded stem + translucent droplets
  mountPetal(g, 'spout', '#BFE4FF', 0.3, 0.05, 0.03, [0.05, 0.98, 0], [0, 0, 0.06], { puff: 0.35 });
  flesh(g, '#BFE4FF', 0.1, [-0.1, 1.32, 0.05], [1, 1, 1], { transparent: true, opacity: 0.9 });
  flesh(g, '#BFE4FF', 0.08, [0.22, 1.35, -0.04], [1, 1, 1], { transparent: true, opacity: 0.9 });
  flesh(g, '#BFE4FF', 0.07, [0.05, 1.45, 0], [1, 1, 1], { transparent: true, opacity: 0.9 });

  surfaceEye(g, bodyC, bodyR, 0.5, 0.1, 0.19);
  surfaceEye(g, bodyC, bodyR, -0.5, 0.1, 0.19);
  surfaceBlush(g, blush, bodyC, bodyR, 0.72, -0.16, 0.11);
  surfaceBlush(g, blush, bodyC, bodyR, -0.72, -0.16, 0.11);
  smileArc(g, [1.12, -0.24, 0.4], 0.1, 1.7);

  g.rotation.y = -0.4;
  return g;
}

// ----------------------------------------------------------------- octopus

function buildOctopus(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#B28DFF';
  const belly = o.bellyColor ?? '#D5C1FF';
  const accent = o.accentColor ?? '#A37EF5';
  const blush = o.blushColor ?? '#FF9FC0';

  const g = new THREE.Group();
  g.name = 'cute-octopus-v2';

  // big dome head, face-forward
  const bodyC = new THREE.Vector3(0, 0.22, 0);
  const bodyR = new THREE.Vector3(0.88, 1.0, 0.88);
  flesh(g, body, 1, [0, 0.22, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.78, [0.18, 0.02, 0], [0.78, 0.72, 0.8]);

  // a full skirt of curling tentacle petals
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x = Math.cos(a) * 0.64;
    const z = Math.sin(a) * 0.64;
    mountPetal(
      g,
      `leg${i}`,
      accent,
      0.66 + (i % 2) * 0.12,
      0.15,
      0.05,
      [x, -0.66, z],
      [Math.sin(a) * 1.05, 0, Math.PI - Math.cos(a) * 1.05 + (i % 2 ? 0.15 : -0.12)],
      { lean: (i % 2 ? 1 : -1) * 0.12, puff: 0.55 },
    );
  }

  surfaceEye(g, bodyC, bodyR, 0.35, 0.28, 0.22);
  surfaceEye(g, bodyC, bodyR, -0.35, 0.28, 0.22);
  surfaceBlush(g, blush, bodyC, bodyR, 0.6, -0.02, 0.12);
  surfaceBlush(g, blush, bodyC, bodyR, -0.6, -0.02, 0.12);
  smileArc(g, [0.86, 0.02, 0], 0.09, 1.7, true);

  g.rotation.y = -0.95;
  return g;
}

// ----------------------------------------------------------------- lobster

function buildLobster(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#E8604A';
  const head = '#F2836F';
  const accent = o.accentColor ?? '#D14C36';
  const blush = o.blushColor ?? '#FFB4A4';

  const g = new THREE.Group();
  g.name = 'cute-lobster-v2';

  // segmented chibi body: big head, sleek tail
  const headC = new THREE.Vector3(0.42, 0.1, 0);
  const headR = new THREE.Vector3(0.5, 0.46, 0.44);
  flesh(g, head, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);
  flesh(g, body, 0.42, [-0.15, 0, 0], [1.25, 0.85, 0.8]);

  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.62, -0.02, 0);
  g.add(tail);
  flesh(tail, body, 0.3, [-0.15, 0.02, 0], [1.1, 0.8, 0.72]);
  flesh(tail, body, 0.22, [-0.45, 0.1, 0], [1.0, 0.8, 0.66]);
  mountPetal(tail, 'fan', accent, 0.42, 0.2, 0.05, [-0.6, 0.16, 0], [0, 0, 2.3], { lean: -0.1, puff: 0.6 });

  // molded pincers on shoulder pivots (shares the crab's claw silhouette)
  for (const side of [1, -1] as const) {
    const arm = new THREE.Group();
    arm.name = side > 0 ? 'clawL' : 'clawR';
    arm.position.set(0.55, -0.42, side * 0.5);
    mountPetal(arm, `arm${side}`, accent, 0.26, 0.08, 0.05, [0, 0, 0], [side * 0.5, 0, -1.15], { puff: 0.5 });
    const claw = new THREE.Mesh(molded(clawShape(), 0.08, 0.6), vinyl(body));
    claw.position.set(0.3, 0.02, side * 0.16);
    claw.rotation.set(side * 0.35, side * -0.4, 0.15);
    claw.scale.setScalar(0.6);
    arm.add(claw);
    g.add(arm);
  }

  // antennae + little legs
  for (const zs of [0.12, -0.12]) {
    mountPetal(g, `antenna${zs > 0 ? 'L' : 'R'}`, accent, 0.66, 0.045, 0.03, [0.68, 0.48, zs], [zs * 2.6, 0, -0.6], { lean: 0.16, puff: 0.35 });
  }
  for (const side of [1, -1] as const) {
    for (let i = 0; i < 2; i++) {
      mountPetal(g, `leg${side}${i}`, accent, 0.24, 0.06, 0.04, [0.1 - i * 0.28, -0.32, side * 0.34], [side * 1.9, 0, i * 0.15], { puff: 0.4 });
    }
  }

  surfaceEye(g, headC, headR, 0.48, 0.2, 0.15);
  surfaceEye(g, headC, headR, -0.48, 0.2, 0.15);
  surfaceBlush(g, blush, headC, headR, 0.7, -0.12, 0.08);
  surfaceBlush(g, blush, headC, headR, -0.7, -0.12, 0.08);
  smileArc(g, [0.92, -0.02, 0.18], 0.06, 1.7);

  g.rotation.y = -0.5;
  return g;
}

// --------------------------------------------------------------- jellyfish

function buildJellyfish(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#9FD8FF';
  const inner = o.bellyColor ?? '#C8ECFF';
  const accent = o.accentColor ?? '#CFEAFF';
  const blush = o.blushColor ?? '#FFB9CD';

  const g = new THREE.Group();
  g.name = 'cute-jellyfish-v2';

  // translucent bell (64-segment partial sphere) + inner glow
  const bell = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, SEG, SEG / 2, 0, Math.PI * 2, 0, Math.PI * 0.58),
    vinyl(body, { transparent: true, opacity: 0.85, roughness: 0.35 }),
  );
  bell.position.y = 0.1;
  bell.scale.set(1, 1.05, 1);
  g.add(bell);
  flesh(g, inner, 0.62, [0, 0.16, 0], [0.9, 0.72, 0.9], { transparent: true, opacity: 0.6 });
  // soft under-body closing the bell
  flesh(g, inner, 0.72, [0, 0.08, 0], [1.0, 0.3, 1.0], { transparent: true, opacity: 0.9 });

  // frilly tentacle skirt — alternating long and short, alternating curl
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = Math.cos(a) * 0.54;
    const z = Math.sin(a) * 0.54;
    mountPetal(
      g,
      `leg${i}`,
      accent,
      0.6 + (i % 2) * 0.18,
      0.11,
      0.04,
      [x, -0.06, z],
      [Math.sin(a) * 0.9, 0, Math.PI - Math.cos(a) * 0.9 + (i % 2 ? 0.24 : -0.18)],
      { lean: (i % 2 ? 1 : -1) * 0.16, puff: 0.45 },
    );
  }

  const bellC = new THREE.Vector3(0, 0.12, 0);
  const bellR = new THREE.Vector3(0.78, 0.82, 0.78);
  surfaceEye(g, bellC, bellR, 0.35, 0.1, 0.19);
  surfaceEye(g, bellC, bellR, -0.35, 0.1, 0.19);
  surfaceBlush(g, blush, bellC, bellR, 0.6, -0.12, 0.11);
  surfaceBlush(g, blush, bellC, bellR, -0.6, -0.12, 0.11);
  smileArc(g, [0.76, -0.14, 0], 0.08, 1.7, true);

  g.rotation.y = -0.9;
  return g;
}

// ---------------------------------------------------------------- starfish

function buildStarfish(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#FFBE5E';
  const dots = o.bellyColor ?? '#FFD98F';
  const blush = o.blushColor ?? '#FFA9BC';

  const g = new THREE.Group();
  g.name = 'cute-starfish-v2';

  // plump center + five molded petal arms in the XY plane (faces +Z)
  flesh(g, body, 0.44, [0, 0, 0], [1, 0.95, 0.55]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    mountPetal(g, `arm${i}`, body, 0.6, 0.22, 0.12, [Math.cos(a) * 0.28, Math.sin(a) * 0.27, 0], [0, 0, a - Math.PI / 2], { puff: 0.8 });
    // freckle stud near each arm tip
    flesh(g, dots, 0.055, [Math.cos(a) * 0.62, Math.sin(a) * 0.6, 0.16]);
  }

  // face on the front (+Z) of the center
  const C = new THREE.Vector3(0, 0, 0);
  const R = new THREE.Vector3(0.48, 0.46, 0.34);
  surfaceEye(g, C, R, Math.PI / 2 - 0.42, 0.22, 0.15);
  surfaceEye(g, C, R, Math.PI / 2 + 0.42, 0.22, 0.15);
  surfaceBlush(g, blush, C, R, Math.PI / 2 - 0.72, -0.1, 0.08);
  surfaceBlush(g, blush, C, R, Math.PI / 2 + 0.72, -0.1, 0.08);
  smileArc(g, [0, -0.14, 0.32], 0.07, 1.7);

  g.rotation.y = 0.35; // gentle 3/4 tilt
  return g;
}

// -------------------------------------------------------------------- seal

function buildSeal(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#C4CFDC';
  const head = '#D6DFE9';
  const belly = o.bellyColor ?? '#EEF3F8';
  const accent = o.accentColor ?? '#A9B7C6';
  const blush = o.blushColor ?? '#F5B8C6';

  const g = new THREE.Group();
  g.name = 'cute-seal-v2';

  // sloped fleshy body rising into a big round head
  flesh(g, body, 0.62, [-0.3, -0.2, 0], [1.3, 0.75, 0.85]);
  flesh(g, belly, 0.55, [0.1, -0.32, 0], [1.15, 0.55, 0.78]);
  const headC = new THREE.Vector3(0.45, 0.35, 0);
  const headR = new THREE.Vector3(0.56, 0.54, 0.52);
  flesh(g, head, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);

  // muzzle + nose + whisker dots
  flesh(g, '#FFFFFF', 0.24, [0.86, 0.2, 0], [1.05, 0.78, 0.88]);
  flesh(g, '#3A3F4D', 0.08, [1.06, 0.32, 0], [1, 0.82, 0.9]);
  for (const zs of [0.16, -0.16]) flesh(g, '#8C9BAB', 0.026, [1.0, 0.16, zs]);

  // molded front flippers + tail flukes
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.44, 0.15, 0.05, [0.25, -0.5, side * 0.45], [side * 0.85, 0, -1.6], { lean: side * 0.08, puff: 0.55 });
  }
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-1.02, -0.22, 0);
  g.add(tail);
  for (const side of [1, -1] as const) {
    mountPetal(tail, `fluke${side}`, accent, 0.38, 0.14, 0.05, [-0.06, 0, 0], [side * 1.25, 0, 2.35], { lean: side * 0.08, puff: 0.5 });
  }

  surfaceEye(g, headC, headR, 0.42, 0.28, 0.17);
  surfaceEye(g, headC, headR, -0.42, 0.28, 0.17);
  surfaceBlush(g, blush, headC, headR, 0.68, -0.05, 0.1);
  surfaceBlush(g, blush, headC, headR, -0.68, -0.05, 0.1);
  smileArc(g, [1.0, 0.08, 0.2], 0.06, 1.7);

  g.rotation.y = -0.45;
  return g;
}

// --------------------------------------------------------------- blue whale

function buildBlueWhale(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#5E93CE';
  const belly = o.bellyColor ?? '#C9DDF2';
  const accent = o.accentColor ?? '#4C7FBB';
  const blush = o.blushColor ?? '#FFB3C7';

  const g = new THREE.Group();
  g.name = 'cute-bluewhale-v2';

  // long, majestic-but-plump body (distinct from Bloop's round spout whale)
  const bodyC = new THREE.Vector3(0.05, 0, 0);
  const bodyR = new THREE.Vector3(1.62, 0.85, 0.9);
  flesh(g, body, 1, [0.05, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, belly, 0.94, [0.15, -0.22, 0], [1.5, 0.62, 0.84]);

  // tiny far-back dorsal (a blue whale signature)
  mountPetal(g, 'dorsal', accent, 0.26, 0.11, 0.05, [-0.75, 0.6, 0], [0, 0, 0.7], { lean: -0.08, puff: 0.5 });

  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-1.55, 0.12, 0);
  g.add(tail);
  flesh(tail, body, 0.22, [-0.02, 0, 0], [1.1, 0.68, 0.65]);
  for (const side of [1, -1] as const) {
    mountPetal(tail, `fluke${side}`, accent, 0.52, 0.18, 0.05, [-0.18, 0.05, 0], [side * 1.2, 0, 0.55], { lean: side * 0.1, puff: 0.55 });
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.44, 0.14, 0.05, [0.5, -0.42, side * 0.66], [side * 1.15, 0, -1.5], { puff: 0.5 });
  }

  surfaceEye(g, bodyC, bodyR, 0.55, 0.1, 0.17);
  surfaceEye(g, bodyC, bodyR, -0.55, 0.1, 0.17);
  surfaceBlush(g, blush, bodyC, bodyR, 0.78, -0.14, 0.1);
  surfaceBlush(g, blush, bodyC, bodyR, -0.78, -0.14, 0.1);
  smileArc(g, [1.5, -0.2, 0.42], 0.11, 1.85);

  g.rotation.y = -0.35;
  return g;
}

// ----------------------------------------------------------------- mermaid

function buildMermaid(o: CuteCreatureV2Options): THREE.Group {
  const fin = o.bodyColor ?? '#59D0B4';
  const finDeep = o.accentColor ?? '#3FBFA0';
  const skin = '#FFD9BE';
  const hair = '#FF6B9D';
  const blush = o.blushColor ?? '#FFB3C7';

  const g = new THREE.Group();
  g.name = 'cute-mermaid-v2';

  // curving tail: shrinking fleshy segments ending in molded flukes
  flesh(g, fin, 0.3, [-0.08, -0.18, 0], [1.15, 0.85, 0.85]);
  flesh(g, fin, 0.24, [-0.42, -0.42, 0], [1.15, 0.85, 0.8]);
  flesh(g, fin, 0.18, [-0.72, -0.58, 0], [1.05, 0.85, 0.75]);
  const tail = new THREE.Group();
  tail.name = 'tail';
  tail.position.set(-0.92, -0.64, 0);
  g.add(tail);
  mountPetal(tail, 'flukeUp', finDeep, 0.42, 0.15, 0.05, [0, 0, 0], [0, 0, 1.45], { lean: 0.12, puff: 0.55 });
  mountPetal(tail, 'flukeDn', finDeep, 0.36, 0.13, 0.05, [0, 0, 0], [0, 0, 2.15], { lean: -0.1, puff: 0.5 });
  // scale sparkles along the tail's camera side
  for (let i = 0; i < 3; i++) flesh(g, '#8FE8D4', 0.05, [-0.15 - i * 0.3, -0.28 - i * 0.18, 0.26]);

  // waist + torso + seashell top
  flesh(g, fin, 0.26, [0.12, 0.02, 0], [1, 0.6, 1]);
  flesh(g, skin, 0.24, [0.16, 0.32, 0], [0.95, 1.2, 0.85]);
  for (const side of [1, -1] as const) {
    flesh(g, '#FF8FB3', 0.1, [0.32, 0.46, side * 0.11], [1, 0.9, 1]);
    // slim arms resting downward
    mountPetal(g, side > 0 ? 'armL' : 'armR', skin, 0.38, 0.07, 0.04, [0.16, 0.52, side * 0.24], [side * 0.55, 0, Math.PI - side * 0.28], { puff: 0.4 });
  }

  // big chibi head + hair cap + flowing molded strands
  const headC = new THREE.Vector3(0.2, 0.95, 0);
  const headR = new THREE.Vector3(0.34, 0.34, 0.33);
  flesh(g, skin, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);
  flesh(g, hair, 0.37, [0.06, 1.05, 0], [1.08, 0.95, 1.08]);
  flesh(g, hair, 0.18, [0.4, 1.18, 0], [0.9, 0.55, 0.95]); // side-swept bangs
  mountPetal(g, 'hairA', hair, 0.62, 0.16, 0.05, [-0.22, 0.98, 0.16], [0.25, 0, 2.55], { lean: 0.18, puff: 0.55 });
  mountPetal(g, 'hairB', hair, 0.55, 0.14, 0.05, [-0.26, 0.92, -0.18], [-0.25, 0, 2.7], { lean: 0.14, puff: 0.5 });
  flesh(g, '#FFE08A', 0.07, [0.28, 1.28, 0.14]); // little star pin

  surfaceEye(g, headC, headR, 0.42, 0.08, 0.1);
  surfaceEye(g, headC, headR, -0.42, 0.08, 0.1);
  surfaceBlush(g, blush, headC, headR, 0.68, -0.22, 0.055);
  surfaceBlush(g, blush, headC, headR, -0.68, -0.22, 0.055);
  smileArc(g, [0.52, 0.84, 0.08], 0.045, 1.7);

  g.rotation.y = -0.4;
  return g;
}

// -------------------------------------------------------------- plesiosaur

function buildPlesiosaur(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#6FCBAD';
  const belly = o.bellyColor ?? '#DCF4E9';
  const accent = o.accentColor ?? '#54B693';
  const blush = o.blushColor ?? '#FFB3C7';

  const g = new THREE.Group();
  g.name = 'cute-plesiosaur-v2';

  // plump body + long curving neck + big chibi head
  flesh(g, body, 0.72, [-0.28, -0.3, 0], [1.25, 0.75, 0.95]);
  flesh(g, belly, 0.62, [-0.18, -0.46, 0], [1.15, 0.52, 0.85]);
  const neck: [number, number][] = [[0.3, 0.0], [0.5, 0.38], [0.64, 0.76]];
  neck.forEach(([x, y], i) => flesh(g, body, 0.27 - i * 0.02, [x, y, 0]));
  const headC = new THREE.Vector3(0.76, 1.12, 0);
  const headR = new THREE.Vector3(0.36, 0.3, 0.3);
  flesh(g, body, 1, [headC.x, headC.y, headC.z], [headR.x, headR.y, headR.z]);

  // little molded back plates marching down the spine
  for (let i = 0; i < 3; i++) {
    mountPetal(g, `plate${i}`, accent, 0.2 - i * 0.03, 0.09, 0.04, [-0.15 - i * 0.34, 0.28 - i * 0.06, 0], [0, 0, 0.15 + i * 0.12], { puff: 0.5 });
  }

  // flippers + rounded molded tail
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'finL' : 'finR', accent, 0.44, 0.15, 0.05, [0.05, -0.58, side * 0.5], [side * 0.9, 0, -1.7], { lean: side * 0.1, puff: 0.55 });
  }
  mountPetal(g, 'tail', body, 0.6, 0.2, 0.06, [-1.05, -0.28, 0], [0, 0, 1.95], { lean: -0.14, puff: 0.6 });

  surfaceEye(g, headC, headR, 0.42, 0.15, 0.11);
  surfaceEye(g, headC, headR, -0.42, 0.15, 0.11);
  surfaceBlush(g, blush, headC, headR, 0.68, -0.22, 0.055);
  surfaceBlush(g, blush, headC, headR, -0.68, -0.22, 0.055);
  smileArc(g, [1.08, 1.0, 0.1], 0.05, 1.7);

  g.rotation.y = -0.4;
  return g;
}

// ------------------------------------------------------------------- grump

function buildGrump(o: CuteCreatureV2Options): THREE.Group {
  const body = o.bodyColor ?? '#666A93';
  const tint = o.bellyColor ?? '#7B7FAD';
  const stud = o.accentColor ?? '#51547B';
  const dark = '#2E3050';
  const blush = o.blushColor ?? '#C87F95';

  const g = new THREE.Group();
  g.name = 'cute-grump-v2';

  const bodyC = new THREE.Vector3(0, 0, 0);
  const bodyR = new THREE.Vector3(0.8, 0.8, 0.8);
  flesh(g, body, 1, [0, 0, 0], [bodyR.x, bodyR.y, bodyR.z]);
  flesh(g, tint, 0.72, [0.1, -0.06, 0], [0.92, 0.86, 0.92]);

  // blunt molded studs, face kept clear
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 10; i++) {
    const gr = (1 + Math.sqrt(5)) / 2;
    const y = 1 - ((i + 0.5) / 10) * 2;
    const rr = Math.sqrt(1 - y * y);
    const a = (2 * Math.PI * i) / gr;
    const dir = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    if (dir.x > 0.35) continue;
    const spike = mountPetal(g, `stud${i}`, stud, 0.24, 0.11, 0.05, [dir.x * 0.76, dir.y * 0.76, dir.z * 0.76], [0, 0, 0], { puff: 0.45 });
    spike.quaternion.setFromUnitVectors(up, dir);
  }

  // grumpy face: big wet eyes under heavy angled brows, pouty frown
  surfaceEye(g, bodyC, bodyR, 0.35, 0.08, 0.2);
  surfaceEye(g, bodyC, bodyR, -0.35, 0.08, 0.2);
  for (const side of [1, -1] as const) {
    mountPetal(g, side > 0 ? 'browL' : 'browR', dark, 0.34, 0.08, 0.05, [0.62, 0.44, side * 0.34], [0, side * 0.5, side > 0 ? -2.1 : 2.1], { puff: 0.45 });
  }
  surfaceBlush(g, blush, bodyC, bodyR, 0.6, -0.18, 0.11);
  surfaceBlush(g, blush, bodyC, bodyR, -0.6, -0.18, 0.11);
  // inverted arc = pout (arc centered at the top of the ring)
  const pout = new THREE.Mesh(
    new THREE.TorusGeometry(0.12, 0.028, 12, 32, 1.5),
    vinyl(dark, { roughness: 0.4 }),
  );
  pout.position.set(0.82, -0.28, 0);
  pout.rotation.set(0, Math.PI / 2, Math.PI / 2 - 0.75);
  g.add(pout);

  g.rotation.y = -0.95;
  return g;
}
