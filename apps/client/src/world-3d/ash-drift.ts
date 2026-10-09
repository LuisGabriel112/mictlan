import * as THREE from 'three';
import { COMBAT_RULES } from '@mictlan/core';
import { ATMOSPHERE } from './atmosphere-config';
import { hash01 } from './stone-floor';

const ASH_LOOK = { color: 0x9aa6c0, size: 0.09, opacity: 0.55 } as const;

function seedPositions(): Float32Array {
  const positions = new Float32Array(ATMOSPHERE.ash.count * 3);
  for (let index = 0; index < ATMOSPHERE.ash.count; index += 1) {
    const angle = hash01(1, index) * Math.PI * 2;
    const radius = Math.sqrt(hash01(2, index)) * COMBAT_RULES.arena.wallRadiusMeters;
    positions.set([Math.cos(angle) * radius, hash01(3, index) * ATMOSPHERE.ash.topMeters, -Math.sin(angle) * radius], index * 3);
  }
  return positions;
}

export class AshDrift {
  private readonly geometry = new THREE.BufferGeometry();
  private readonly material = new THREE.PointsMaterial({ ...ASH_LOOK, transparent: true, depthWrite: false });
  private lastMs?: number;

  constructor(scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(seedPositions(), 3));
    const ash = new THREE.Points(this.geometry, this.material);
    ash.name = 'ash';
    scene.add(ash);
  }

  update(nowMs: number): void {
    // Clamped so a backgrounded tab does not fling the ash on return.
    const elapsed = this.lastMs === undefined ? 0 : (nowMs - this.lastMs) / 1000;
    this.lastMs = nowMs;
    const rise = ATMOSPHERE.ash.riseMetersPerSecond * Math.min(ATMOSPHERE.ash.maxStepSeconds, Math.max(0, elapsed));
    const positions = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let index = 0; index < positions.count; index += 1) {
      positions.setY(index, (positions.getY(index) + rise) % ATMOSPHERE.ash.topMeters);
    }
    positions.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
