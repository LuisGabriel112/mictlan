import * as THREE from 'three';
import type { Point } from '../snapshot';
import type { ArenaWorld, WorldFrame } from './arena-world';
import { Atmosphere } from './atmosphere';
import { CastLayer } from './cast-layer';
import { EffectLayer } from './effect-layer';
import { GroundLayer } from './ground-layer';
import { isoCamera, pickGround, projectToScreen, type IsoCamera } from './iso-camera';
import { UnitLayer } from './unit-layer';

export interface WorldRenderer {
  readonly domElement: HTMLCanvasElement;
  setSize(width: number, height: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

const CAMERA_DEPTH = { near: 1, far: 200 } as const;

export class ThreeArenaWorld implements ArenaWorld {
  private readonly scene = new THREE.Scene();
  private readonly atmosphere = new Atmosphere(this.scene);
  private readonly camera = new THREE.OrthographicCamera();
  private readonly units = new UnitLayer(this.scene);
  private readonly ground = new GroundLayer(this.scene);
  private readonly casts = new CastLayer(this.scene);
  private readonly effects = new EffectLayer(this.scene);
  private rig: IsoCamera = isoCamera(1, 1);

  constructor(private readonly renderer: WorldRenderer) {
    this.resize(1, 1);
  }

  resize(width: number, height: number): void {
    this.rig = isoCamera(width, height);
    const { halfWidth, halfHeight, position } = this.rig;
    Object.assign(this.camera, { left: -halfWidth, right: halfWidth, top: halfHeight, bottom: -halfHeight, ...CAMERA_DEPTH });
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  pick(pixel: Point): Point {
    return pickGround(this.rig, pixel);
  }

  project(world: Point, heightMeters = 0): Point {
    return projectToScreen(this.rig, world, heightMeters);
  }

  render(frame: WorldFrame): void {
    this.units.update(frame);
    this.ground.update(frame);
    this.casts.update(frame);
    this.effects.update(frame);
    this.atmosphere.update(frame);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.units.dispose();
    this.ground.dispose();
    this.casts.dispose();
    this.effects.dispose();
    this.atmosphere.dispose();
    this.renderer.dispose();
  }
}
