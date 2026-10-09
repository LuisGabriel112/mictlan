import * as THREE from 'three';

// Concentric flagstones; the grout is simply the dark background showing through the gaps.
export const STONE_FLOOR = { ringWidthMeters: 2.2, gapMeters: 0.08, slabLengthMeters: 2.4, arcSegments: 4,
  baseTone: 0.16, toneSpread: 0.07 } as const;

interface Slab { inner: number; outer: number; start: number; end: number; tone: number }
interface FloorBuffers { positions: number[]; colors: number[] }

// Cheap deterministic hash in [0, 1): stable across runs so every client sees the same floor and ash.
export function hash01(a: number, b: number): number {
  const hash = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return hash - Math.floor(hash);
}

export function stoneTone(ring: number, slab: number): number {
  return STONE_FLOOR.baseTone + (hash01(ring, slab) - 0.5) * STONE_FLOOR.toneSpread;
}

function ringSlabs(ring: number, radius: number): Slab[] {
  const inner = ring * STONE_FLOOR.ringWidthMeters + (ring === 0 ? 0 : STONE_FLOOR.gapMeters / 2);
  const outer = Math.min(radius, (ring + 1) * STONE_FLOOR.ringWidthMeters - STONE_FLOOR.gapMeters / 2);
  const count = Math.max(6, Math.round((Math.PI * (inner + outer)) / STONE_FLOOR.slabLengthMeters));
  const gapAngle = STONE_FLOOR.gapMeters / Math.max(outer, 1);
  return Array.from({ length: count }, (_, slab) => ({ inner, outer, tone: stoneTone(ring, slab),
    start: (slab / count) * Math.PI * 2 + gapAngle / 2, end: ((slab + 1) / count) * Math.PI * 2 - gapAngle / 2 }));
}

function pushVertex(target: FloorBuffers, radius: number, angle: number, tone: number): void {
  target.positions.push(Math.cos(angle) * radius, 0, -Math.sin(angle) * radius);
  target.colors.push(tone, tone * 1.04, tone * 1.18);
}

function pushSlab(target: FloorBuffers, slab: Slab): void {
  const step = (slab.end - slab.start) / STONE_FLOOR.arcSegments;
  for (let index = 0; index < STONE_FLOOR.arcSegments; index += 1) {
    const a = slab.start + step * index;
    const b = a + step;
    // Counter-clockwise seen from above so the normals face up.
    for (const [r, angle] of [[slab.inner, a], [slab.outer, a], [slab.outer, b], [slab.inner, a], [slab.outer, b], [slab.inner, b]]) {
      pushVertex(target, r, angle, slab.tone);
    }
  }
}

export function stoneFloorGeometry(radius: number): THREE.BufferGeometry {
  const target: FloorBuffers = { positions: [], colors: [] };
  const rings = Math.ceil(radius / STONE_FLOOR.ringWidthMeters);
  for (let ring = 0; ring < rings; ring += 1) ringSlabs(ring, radius).forEach((slab) => pushSlab(target, slab));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(target.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(target.colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
