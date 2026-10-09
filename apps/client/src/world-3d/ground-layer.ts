import * as THREE from 'three';
import { COMBAT_RULES } from '@mictlan/core';
import { unsafeRing, windWarningStyle } from '../danger-reading';
import { entityRadius, type Point, type ZoneSnapshot } from '../snapshot';
import type { WorldFrame } from './arena-world';
import { toScene } from './iso-camera';

type FlatMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
interface ZoneMeshes { disc: FlatMesh; border: FlatMesh }

const WALL_RADIUS = COMBAT_RULES.arena.wallRadiusMeters;
const COLORS = { floor: 0x2a2233, wall: 0xd9c08c, unsafe: 0xff4444, zone: 0xff2222, self: 0xffffff,
  target: 0xffe066, destination: 0x2ec4b6 } as const;
// Stacked decal heights avoid z-fighting between ground overlays.
const LAYER_Y = { unsafe: 0.01, zone: 0.02, zoneBorder: 0.03, ring: 0.04, destination: 0.05 } as const;
const RING_GAP_METERS = { self: 0.1, target: 0.3 } as const;
const UNSAFE_BAND_OPACITY = 0.22;
const WALL_THICKNESS_METERS = 0.35;

function overlay(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide });
}

function flat<M extends THREE.Material>(geometry: THREE.BufferGeometry, material: M, name: string, height: number) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = height;
  return mesh;
}

function placeFlat(mesh: THREE.Object3D, point: Point, scale: number): void {
  const { x, z } = toScene(point);
  mesh.position.set(x, mesh.position.y, z);
  mesh.scale.set(scale, scale, 1);
  mesh.visible = true;
}

function detach(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>): void {
  mesh.removeFromParent();
  mesh.material.dispose();
}

function free(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.Material>): void {
  detach(mesh);
  mesh.geometry.dispose();
}

function stoneWall() {
  return flat(new THREE.TorusGeometry(WALL_RADIUS, WALL_THICKNESS_METERS, 8, 96),
    new THREE.MeshLambertMaterial({ color: COLORS.wall }), 'wall', WALL_THICKNESS_METERS);
}

export class GroundLayer {
  private readonly floor = flat(new THREE.CircleGeometry(WALL_RADIUS, 96), new THREE.MeshLambertMaterial({ color: COLORS.floor }), 'floor', 0);
  private readonly wall = stoneWall();
  private readonly unsafeBand: FlatMesh = flat(new THREE.RingGeometry(WALL_RADIUS, WALL_RADIUS, 96), overlay(COLORS.unsafe, UNSAFE_BAND_OPACITY), 'unsafe-band', LAYER_Y.unsafe);
  private readonly safeEdge = flat(new THREE.RingGeometry(0.985, 1, 128), overlay(COLORS.unsafe, 0.9), 'safe-edge', LAYER_Y.unsafe);
  private readonly selfRing = flat(new THREE.RingGeometry(1, 1.12, 48), overlay(COLORS.self, 1), 'self-ring', LAYER_Y.ring);
  private readonly targetRing = flat(new THREE.RingGeometry(1, 1.15, 48), overlay(COLORS.target, 1), 'target-ring', LAYER_Y.ring);
  private readonly destination = flat(new THREE.RingGeometry(0.3, 0.42, 32), overlay(COLORS.destination, 1), 'destination', LAYER_Y.destination);
  private readonly zoneDisc = new THREE.CircleGeometry(1, 48);
  private readonly zoneBorder = new THREE.RingGeometry(0.94, 1, 64);
  private readonly zones = new Map<string, ZoneMeshes>();
  private unsafeInner: number = WALL_RADIUS;

  constructor(private readonly scene: THREE.Scene) {
    scene.add(this.floor, this.wall, this.unsafeBand, this.safeEdge, this.selfRing, this.targetRing, this.destination);
  }

  update(frame: WorldFrame): void {
    this.updateUnsafe(frame);
    this.updateRings(frame);
    this.updateZones(frame);
    this.destination.visible = false;
    if (frame.destination) placeFlat(this.destination, frame.destination, 1);
  }

  dispose(): void {
    this.zones.forEach(({ disc, border }) => [disc, border].forEach(detach));
    this.zones.clear();
    this.zoneDisc.dispose();
    this.zoneBorder.dispose();
    [this.floor, this.wall, this.unsafeBand, this.safeEdge, this.selfRing, this.targetRing, this.destination].forEach(free);
  }

  private updateUnsafe(frame: WorldFrame): void {
    const ring = unsafeRing(frame.snapshot);
    this.unsafeBand.visible = this.safeEdge.visible = Boolean(ring);
    if (!ring) return;
    if (ring.innerRadiusMeters !== this.unsafeInner) {
      // Rebuilt only when the safe radius shrinks, not every frame.
      this.unsafeBand.geometry.dispose();
      this.unsafeBand.geometry = new THREE.RingGeometry(ring.innerRadiusMeters, ring.outerRadiusMeters, 96);
      this.unsafeInner = ring.innerRadiusMeters;
    }
    placeFlat(this.safeEdge, { x: 0, y: 0 }, ring.innerRadiusMeters);
  }

  private updateRings(frame: WorldFrame): void {
    const self = frame.snapshot.entities[frame.selfId];
    const target = self ? frame.snapshot.entities[self.targetId] : undefined;
    this.selfRing.visible = this.targetRing.visible = false;
    if (self) placeFlat(this.selfRing, frame.positions[self.id] ?? self, entityRadius(self) + RING_GAP_METERS.self);
    if (target) placeFlat(this.targetRing, frame.positions[target.id] ?? target, entityRadius(target) + RING_GAP_METERS.target);
  }

  private updateZones(frame: WorldFrame): void {
    const zones = Object.values(frame.snapshot.zones);
    for (const zone of zones) this.placeZone(this.zoneFor(zone.id), zone, frame.nowMs);
    const present = new Set(zones.map(({ id }) => id));
    for (const [id, meshes] of this.zones) {
      if (present.has(id)) continue;
      [meshes.disc, meshes.border].forEach(detach);
      this.zones.delete(id);
    }
  }

  private zoneFor(id: string): ZoneMeshes {
    const existing = this.zones.get(id);
    if (existing) return existing;
    const meshes = { disc: flat(this.zoneDisc, overlay(COLORS.zone, 0), `zone:${id}`, LAYER_Y.zone),
      border: flat(this.zoneBorder, overlay(COLORS.zone, 0), `zone-border:${id}`, LAYER_Y.zoneBorder) };
    this.scene.add(meshes.disc, meshes.border);
    this.zones.set(id, meshes);
    return meshes;
  }

  private placeZone({ disc, border }: ZoneMeshes, zone: ZoneSnapshot, nowMs: number): void {
    const style = windWarningStyle(zone.remainingTicks, nowMs);
    disc.material.opacity = style.fillAlpha;
    border.material.opacity = style.borderAlpha;
    placeFlat(disc, zone, zone.radiusMeters);
    // The pulsing border width from T3.4 becomes a slight outward swell in meters.
    placeFlat(border, zone, zone.radiusMeters + style.borderWidth * 0.02);
  }
}
