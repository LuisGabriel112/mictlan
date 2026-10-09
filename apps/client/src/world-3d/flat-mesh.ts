import * as THREE from 'three';
import type { Point } from '../snapshot';
import { toScene } from './iso-camera';

export type BasicMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;

export function overlay(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide });
}

// Lays an XY-plane geometry (ring, circle) flat on the arena floor.
export function flat<M extends THREE.Material>(geometry: THREE.BufferGeometry, material: M, name: string, height: number) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = height;
  return mesh;
}

export function placeFlat(mesh: THREE.Object3D, point: Point, scale: number): void {
  const { x, z } = toScene(point);
  mesh.position.set(x, mesh.position.y, z);
  mesh.scale.set(scale, scale, 1);
  mesh.visible = true;
}
