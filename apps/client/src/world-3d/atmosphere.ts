import * as THREE from 'three';
import { COMBAT_RULES } from '@mictlan/core';
import { isLiving } from '../snapshot';
import type { WorldFrame } from './arena-world';
import { AshDrift } from './ash-drift';
import { ATMOSPHERE } from './atmosphere-config';
import { BrazierRing } from './brazier-ring';
import { toScene } from './iso-camera';

export { ATMOSPHERE } from './atmosphere-config';

function moonLight(): THREE.DirectionalLight {
  const { color, intensity, position, shadowMapSize } = ATMOSPHERE.moon;
  const moon = new THREE.DirectionalLight(color, intensity);
  moon.name = 'moon';
  moon.position.set(...position);
  moon.castShadow = true;
  const reach = COMBAT_RULES.arena.wallRadiusMeters + 3;
  Object.assign(moon.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 80 });
  moon.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  return moon;
}

function bossLight(): THREE.PointLight {
  const { color, idle, distanceMeters } = ATMOSPHERE.bossLight;
  const light = new THREE.PointLight(color, idle, distanceMeters, 1.5);
  light.name = 'boss-light';
  return light;
}

export class Atmosphere {
  private readonly bossGlow = bossLight();
  private readonly braziers: BrazierRing;
  private readonly ash: AshDrift;

  constructor(scene: THREE.Scene) {
    scene.background = new THREE.Color(ATMOSPHERE.background);
    scene.fog = new THREE.Fog(ATMOSPHERE.fog.color, ATMOSPHERE.fog.near, ATMOSPHERE.fog.far);
    scene.add(new THREE.AmbientLight(ATMOSPHERE.ambient.color, ATMOSPHERE.ambient.intensity), moonLight(), this.bossGlow);
    this.braziers = new BrazierRing(scene);
    this.ash = new AshDrift(scene);
  }

  update(frame: WorldFrame): void {
    this.braziers.update(frame.nowMs);
    this.ash.update(frame.nowMs);
    this.followBoss(frame);
  }

  dispose(): void {
    this.braziers.dispose();
    this.ash.dispose();
  }

  private followBoss(frame: WorldFrame): void {
    const boss = Object.values(frame.snapshot.entities).find((entity) => entity.type === 'boss');
    this.bossGlow.visible = Boolean(boss && isLiving(boss));
    if (!boss || !this.bossGlow.visible) return;
    const { x, y, z } = toScene(frame.positions[boss.id] ?? boss, ATMOSPHERE.bossLight.heightMeters);
    this.bossGlow.position.set(x, y, z);
    this.bossGlow.intensity = boss.cast ? ATMOSPHERE.bossLight.casting : ATMOSPHERE.bossLight.idle;
  }
}
