import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { SceneryPlacement } from './scenery-layout';
import type { SceneryModel } from './scenery-models';

type MaterialParts = Map<THREE.Material, THREE.BufferGeometry[]>;
type DrawGroup = { start: number; count: number; materialIndex?: number };
type SceneryBatch = THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>;

function meshGeometry(mesh: THREE.Mesh, group?: DrawGroup): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone();
  if (group) {
    const indices = Array.from({ length: group.count }, (_, offset) => geometry.index?.getX(group.start + offset) ?? group.start + offset);
    geometry.setIndex(indices);
  }
  const flattened = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flattened !== geometry) geometry.dispose();
  flattened.clearGroups();
  return flattened.applyMatrix4(mesh.matrixWorld);
}

function appendPart(parts: MaterialParts, material: THREE.Material, geometry: THREE.BufferGeometry): void {
  const existing = parts.get(material);
  if (existing) existing.push(geometry);
  else parts.set(material, [geometry]);
}

function collectMesh(parts: MaterialParts, mesh: THREE.Mesh): void {
  const materials: THREE.Material | THREE.Material[] = mesh.material;
  if (!Array.isArray(materials)) {
    appendPart(parts, materials, meshGeometry(mesh));
    return;
  }
  for (const group of mesh.geometry.groups) {
    appendPart(parts, materials[group.materialIndex ?? 0], meshGeometry(mesh, group));
  }
}

function templateParts(template: THREE.Object3D): MaterialParts {
  const parts: MaterialParts = new Map();
  template.traverse((child) => {
    if (child instanceof THREE.Mesh) collectMesh(parts, child);
  });
  return parts;
}

function instanceMatrix(model: SceneryModel, placement: SceneryPlacement): THREE.Matrix4 {
  const scale = placement.height / model.height;
  const matrix = new THREE.Matrix4().makeTranslation(placement.x, placement.y, placement.z);
  matrix.multiply(new THREE.Matrix4().makeRotationY(placement.rotation));
  matrix.multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
  return matrix.multiply(new THREE.Matrix4().makeTranslation(-model.centerX, -model.minY, -model.centerZ));
}

function createBatch(geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[], castShadow: boolean): SceneryBatch {
  const batch = new THREE.InstancedMesh(geometry, material.clone(), matrices.length);
  matrices.forEach((matrix, index) => batch.setMatrixAt(index, matrix));
  batch.instanceMatrix.needsUpdate = true;
  batch.receiveShadow = true;
  batch.castShadow = castShadow;
  batch.computeBoundingSphere();
  return batch;
}

export function sceneryBatches(model: SceneryModel, placements: readonly SceneryPlacement[], castShadow: boolean): SceneryBatch[] {
  if (placements.length === 0) return [];
  const matrices = placements.map((placement) => instanceMatrix(model, placement));
  const batches: SceneryBatch[] = [];
  for (const [material, parts] of templateParts(model.template)) {
    const geometry = mergeGeometries(parts);
    parts.forEach((part) => part.dispose());
    if (geometry) batches.push(createBatch(geometry, material, matrices, castShadow));
  }
  return batches;
}

export function disposeSceneryBatch(batch: SceneryBatch): void {
  batch.removeFromParent();
  batch.dispose();
  batch.geometry.dispose();
  batch.material.dispose();
}
