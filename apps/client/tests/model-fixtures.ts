import * as THREE from 'three';
import { KAYKIT_CLIPS, XOLO_CLIPS, type LoadedGltf, type UnitModel } from '../src/world-3d/models';

// A tiny stand-in for a glTF scene: one bone and one painted box standing from minY to minY + height.
export function fakeScene(height = 2, minY = 0, material: THREE.Material = new THREE.MeshStandardMaterial({ name: 'paint' })): THREE.Group {
  const scene = new THREE.Group();
  const bone = new THREE.Bone();
  bone.name = 'hips';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, height, 1), material);
  mesh.position.y = minY + height / 2;
  scene.add(bone, mesh);
  return scene;
}

export function fakeClip(name: string, durationSeconds = 1): THREE.AnimationClip {
  return new THREE.AnimationClip(name, durationSeconds,
    [new THREE.VectorKeyframeTrack('hips.position', [0, durationSeconds], [0, 0, 0, 1, 0, 0])]);
}

export function fakeFiles(): Record<string, LoadedGltf> {
  const characters = Object.fromEntries(['jaguar', 'eagle', 'healer', 'boss'].map((key) => [`${key}.glb`, { scene: fakeScene(), animations: [] }]));
  return {
    ...characters,
    'Rig_Medium_General.glb': { scene: fakeScene(), animations: ['Idle_A', 'Throw', 'Use_Item', 'Death_A'].map((name) => fakeClip(name)) },
    'Rig_Medium_MovementBasic.glb': { scene: fakeScene(), animations: [fakeClip('Walking_A')] },
    'xolo.glb': { scene: fakeScene(1.5), animations: ['Idle', 'Walk', 'Attack', 'Death', 'Eating'].map((name) => fakeClip(name)) },
  };
}

export function fakeLoad(files: Record<string, LoadedGltf>, base = '/models/') {
  return async (url: string): Promise<LoadedGltf> => {
    const file = files[url.slice(base.length)];
    if (!file) throw new Error(`404 ${url}`);
    return file;
  };
}

// A ready-made model as ModelLibrary hands it to the unit layer.
export function unitModel(key: UnitModel['key'] = 'eagle', template: THREE.Object3D = fakeScene(), attackSeconds = 1): UnitModel {
  const names = key === 'xolo' ? XOLO_CLIPS : KAYKIT_CLIPS;
  const clips = Object.fromEntries(Object.entries(names).map(([animation, name]) =>
    [animation, fakeClip(name, animation === 'attack' ? attackSeconds : 1)]));
  return { key, template, clips, scale: 0.5, offsetY: 0.25 };
}
