// SPEC §9: V Rising night: obsidian background, cold fog, low ambient, cold moon and colored accent lights.
export const ATMOSPHERE = {
  background: 0x06050b,
  fog: { color: 0x0a1020, near: 68, far: 118 },
  ambient: { color: 0x34405e, intensity: 0.55 },
  moon: { color: 0x9fb6ff, intensity: 1.3, position: [-14, 32, 12] as const, shadowMapSize: 2048 },
  pillars: { count: 12, heightMeters: 2.6 },
  braziers: { colors: [0x2ef2d6, 0xa14dff] as const, intensity: 26, distanceMeters: 16, flicker: 0.18 },
  bossLight: { color: 0xa040ff, idle: 18, casting: 45, heightMeters: 4.5, distanceMeters: 14 },
  ash: { count: 180, riseMetersPerSecond: 0.6, topMeters: 9, maxStepSeconds: 1 },
} as const;
