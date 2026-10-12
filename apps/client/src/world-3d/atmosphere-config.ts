// SPEC §9: V Rising night: obsidian background, cold fog, low ambient, cold moon and colored accent lights.
export const ATMOSPHERE = {
  background: 0x06050b,
  fog: { color: 0x0a1020, near: 68, far: 118 },
  ambient: { color: 0x34405e, intensity: 0.55 },
  moon: { color: 0x9fb6ff, intensity: 1.3, position: [-14, 32, 12] as const, shadowMapSize: 2048 },
  pillars: { count: 12, heightMeters: 2.6 },
  scenery: { innerOffsetMeters: 2, outerOffsetMeters: 9, nearHeightMeters: 1, seed: 55, torchHeightMeters: 0.75 },
  braziers: { colors: [0x2ef2d6, 0xa14dff] as const, intensity: 26, distanceMeters: 16, flicker: 0.18 },
  bossLight: { color: 0xa040ff, idle: 18, casting: 45, heightMeters: 4.5, distanceMeters: 14 },
  ash: { count: 180, riseMetersPerSecond: 0.6, topMeters: 9, maxStepSeconds: 1 },
} as const;

export interface ScenerySpec {
  file: string;
  format: 'gltf' | 'fbx';
  height: readonly [number, number];
  count: number;
  castShadow: boolean;
}

// CC0 pack filenames and height classes are fixed by PROMPTS.md T5.5, Datos reales.
export const SCENERY_PIECES = {
  pillar: { file: 'pillar.gltf', format: 'gltf', height: [ATMOSPHERE.pillars.heightMeters, ATMOSPHERE.pillars.heightMeters], count: ATMOSPHERE.pillars.count, castShadow: true },
  torch: { file: 'torch_lit.gltf', format: 'gltf', height: [ATMOSPHERE.scenery.torchHeightMeters, ATMOSPHERE.scenery.torchHeightMeters], count: ATMOSPHERE.pillars.count / 2, castShadow: false },
  rock1: { file: 'Rock_1.fbx', format: 'fbx', height: [0.5, 1], count: 18, castShadow: false },
  rock2: { file: 'Rock_2.fbx', format: 'fbx', height: [0.5, 1], count: 18, castShadow: false },
  plant: { file: 'Plant_1.fbx', format: 'fbx', height: [0.6, 1], count: 24, castShadow: false },
  bush: { file: 'Bush_1.fbx', format: 'fbx', height: [0.6, 1], count: 18, castShadow: false },
  palm: { file: 'PalmTree_1.fbx', format: 'fbx', height: [5, 8], count: 10, castShadow: true },
  candles: { file: 'candle_triple.gltf', format: 'gltf', height: [0.4, 0.4], count: 12, castShadow: false },
  rubble: { file: 'rubble_large.gltf', format: 'gltf', height: [1, 1], count: 14, castShadow: false },
} as const satisfies Record<string, ScenerySpec>;

export type SceneryKey = keyof typeof SCENERY_PIECES;
export const DECORATION_KEYS = ['rock1', 'rock2', 'plant', 'bush', 'palm', 'candles', 'rubble'] as const;
