import * as THREE from 'three';
import { COMBAT_RULES } from '@mictlan/core';
import { ATMOSPHERE } from './atmosphere-config';

const PILLAR_OFFSET_METERS = 0.9;
const STONE = 0x3b3744;

interface Brazier { light: THREE.PointLight; phase: number }

function ringPosition(index: number, height: number): THREE.Vector3 {
  const angle = (index / ATMOSPHERE.pillars.count) * Math.PI * 2;
  const radius = COMBAT_RULES.arena.wallRadiusMeters + PILLAR_OFFSET_METERS;
  return new THREE.Vector3(Math.cos(angle) * radius, height, -Math.sin(angle) * radius);
}

// Two detuned sines read as a living fire without any randomness per frame.
function flicker(nowMs: number, phase: number): number {
  return Math.sin(nowMs * 0.0071 + phase) * Math.sin(nowMs * 0.0113 + phase * 1.7);
}

export class BrazierRing {
  private readonly pillarGeometry = new THREE.CylinderGeometry(0.45, 0.6, ATMOSPHERE.pillars.heightMeters, 8);
  private readonly pillarMaterial = new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.9 });
  private readonly flameGeometry = new THREE.ConeGeometry(0.28, 0.75, 8);
  private readonly flameMaterials: THREE.MeshBasicMaterial[] = [];
  private readonly braziers: Brazier[] = [];

  constructor(private readonly scene: THREE.Scene) {
    for (let index = 0; index < ATMOSPHERE.pillars.count; index += 1) {
      this.addPillar(index);
      if (index % 2 === 0) this.addBrazier(index);
    }
  }

  update(nowMs: number): void {
    const { intensity, flicker: amount } = ATMOSPHERE.braziers;
    for (const brazier of this.braziers) brazier.light.intensity = intensity * (1 + amount * flicker(nowMs, brazier.phase));
  }

  dispose(): void {
    this.pillarGeometry.dispose();
    this.pillarMaterial.dispose();
    this.flameGeometry.dispose();
    this.flameMaterials.forEach((material) => material.dispose());
  }

  private addPillar(index: number): void {
    const pillar = new THREE.Mesh(this.pillarGeometry, this.pillarMaterial);
    pillar.name = `pillar:${index}`;
    pillar.position.copy(ringPosition(index, ATMOSPHERE.pillars.heightMeters / 2));
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.scene.add(pillar);
  }

  private addBrazier(index: number): void {
    const order = this.braziers.length;
    const color = ATMOSPHERE.braziers.colors[order % 2];
    const top = ringPosition(index, ATMOSPHERE.pillars.heightMeters + 0.4);
    const material = new THREE.MeshBasicMaterial({ color });
    const flame = new THREE.Mesh(this.flameGeometry, material);
    flame.name = `flame:${order}`;
    flame.position.copy(top);
    const light = new THREE.PointLight(color, ATMOSPHERE.braziers.intensity, ATMOSPHERE.braziers.distanceMeters, 1.5);
    light.name = `brazier-light:${order}`;
    light.position.copy(top);
    this.flameMaterials.push(material);
    this.braziers.push({ light, phase: order * 2.3 });
    this.scene.add(flame, light);
  }
}
