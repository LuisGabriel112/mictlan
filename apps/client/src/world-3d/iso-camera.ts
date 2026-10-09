import { COMBAT_RULES } from '@mictlan/core';
import type { Point } from '../snapshot';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// SPEC §9: fixed LoL-style isometric view. Headroom keeps the boss body inside the top edge.
export const ISO_VIEW = {
  elevationRadians: 35 * Math.PI / 180,
  azimuthRadians: 45 * Math.PI / 180,
  distanceMeters: 80,
  fitRadiusMeters: COMBAT_RULES.arena.wallRadiusMeters + 2,
  headroomMeters: 3,
} as const;

export interface IsoCamera {
  width: number;
  height: number;
  halfWidth: number;
  halfHeight: number;
  position: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

// Core is x east, y north; Three is y up, so north maps to -z.
export function toScene({ x, y }: Point, heightMeters = 0): Vec3 {
  return { x, y: heightMeters, z: -y };
}

function cameraPosition(): Vec3 {
  const { elevationRadians: el, azimuthRadians: az, distanceMeters } = ISO_VIEW;
  return scale({ x: Math.sin(az) * Math.cos(el), y: Math.sin(el), z: Math.cos(az) * Math.cos(el) }, distanceMeters);
}

function frustum(width: number, height: number): { halfWidth: number; halfHeight: number } {
  const { fitRadiusMeters: radius, elevationRadians: el, headroomMeters } = ISO_VIEW;
  const neededHalfHeight = radius * Math.sin(el) + headroomMeters * Math.cos(el);
  const aspect = width > 0 && height > 0 ? width / height : 1;
  if (radius / neededHalfHeight > aspect) return { halfWidth: radius, halfHeight: radius / aspect };
  return { halfWidth: neededHalfHeight * aspect, halfHeight: neededHalfHeight };
}

export function isoCamera(width: number, height: number): IsoCamera {
  const position = cameraPosition();
  const forward = scale(position, -1 / ISO_VIEW.distanceMeters);
  const right = scale({ x: -forward.z, y: 0, z: forward.x }, 1 / Math.hypot(forward.x, forward.z));
  const up = { x: right.y * forward.z - right.z * forward.y, y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x };
  return { width, height, ...frustum(width, height), position, forward, right, up };
}

export function pickGround(camera: IsoCamera, pixel: Point): Point {
  const u = (2 * pixel.x) / camera.width - 1;
  const v = 1 - (2 * pixel.y) / camera.height;
  const origin = add(camera.position, add(scale(camera.right, u * camera.halfWidth), scale(camera.up, v * camera.halfHeight)));
  const ground = add(origin, scale(camera.forward, -origin.y / camera.forward.y));
  return { x: ground.x, y: -ground.z };
}

export function projectToScreen(camera: IsoCamera, world: Point, heightMeters = 0): Point {
  const offset = add(toScene(world, heightMeters), scale(camera.position, -1));
  const u = dot(offset, camera.right) / camera.halfWidth;
  const v = dot(offset, camera.up) / camera.halfHeight;
  return { x: ((u + 1) / 2) * camera.width, y: ((1 - v) / 2) * camera.height };
}
