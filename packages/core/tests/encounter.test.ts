import { describe, expect, test } from 'vitest';
import { BOSS, CLASSES, COMBAT_RULES, createEncounter, step } from '../src/index.js';
import type { EncounterConfig, EncounterState, Input, PlayerEntity } from '../src/index.js';

const players: EncounterConfig['players'] = [
  { id: 'p1', classId: 'jaguar' },
  { id: 'p2', classId: 'healer' },
  { id: 'p3', classId: 'eagle' },
  { id: 'p4', classId: 'eagle' },
  { id: 'p5', classId: 'eagle' },
];

function createConfig(count = 3): EncounterConfig {
  return { players: players.slice(0, count), critChance: 0 };
}

function getPlayer(state: EncounterState, id = 'p1'): PlayerEntity {
  const entity = state.entities[id];
  if (entity?.type !== 'player') throw new Error(`Missing player: ${id}`);
  return entity;
}

function freezeDeep(value: unknown): void {
  if (value === null || typeof value !== 'object') return;
  for (const nested of Object.values(value)) freezeDeep(nested);
  Object.freeze(value);
}

function tickInputs(tick: number): Input[] {
  const direction = tick % 40 < 20 ? 1 : -1;
  return [
    { playerId: 'p3', type: 'move', dx: direction, dy: 0 },
    { playerId: 'p1', type: 'move', dx: 0, dy: -direction },
    { playerId: 'p2', type: 'move', dx: -3 * direction, dy: 4 * direction },
    { playerId: 'p1', type: 'move', dx: 3 * direction, dy: 4 * direction },
  ];
}

describe('T1.2 encounter creation', () => {
  test.each([
    {
      count: 3,
      expected: [
        { id: 'p1', x: -2, y: -15 },
        { id: 'p2', x: 0, y: -15 },
        { id: 'p3', x: 2, y: -15 },
      ],
    },
    {
      count: 5,
      expected: [
        { id: 'p1', x: -4, y: -15 },
        { id: 'p2', x: -2, y: -15 },
        { id: 'p3', x: 0, y: -15 },
        { id: 'p4', x: 2, y: -15 },
        { id: 'p5', x: 4, y: -15 },
      ],
    },
  ])('initial positions for $count players match SPEC §6', ({ count, expected }) => {
    const config = createConfig(count);
    const state = createEncounter({ ...config, players: [...config.players].reverse() }, 42);
    const positions = Object.values(state.entities)
      .filter((entity) => entity.type === 'player')
      .map(({ id, x, y }) => ({ id, x, y }));
    expect(positions).toEqual(expected);
  });

  test('config order does not affect state and ids use string comparison', () => {
    const config: EncounterConfig = {
      players: [
        { id: 'a', classId: 'jaguar' },
        { id: 'Z', classId: 'healer' },
        { id: 'A', classId: 'eagle' },
      ],
      critChance: 0,
    };
    const before = structuredClone(config);
    freezeDeep(config);
    const state = createEncounter(config, 42);
    expect(state).toEqual(createEncounter({ ...config, players: [...config.players].reverse() }, 42));
    expect(state.config.players.map(({ id }) => id)).toEqual(['A', 'Z', 'a']);
    expect(getPlayer(state, 'A').x).toBe(-2);
    expect(getPlayer(state, 'a').x).toBe(2);
    expect(config).toEqual(before);
  });

  test.each([
    { count: 3, health: BOSS.maxHealthByPlayerCount[3] },
    { count: 4, health: BOSS.maxHealthByPlayerCount[4] },
    { count: 5, health: BOSS.maxHealthByPlayerCount[5] },
  ])('creates an inactive boss with $health health for $count players', ({ count, health }) => {
    const state = createEncounter(createConfig(count), 42);
    expect(state.entities[BOSS.id]).toMatchObject({
      type: 'boss', x: 0, y: 0, health, maxHealth: health, targetId: null, cast: null,
    });
    expect(state).toMatchObject({
      status: 'combat', bossActive: false, tick: 0, elapsedTicks: 0,
      phase: 1, phaseElapsedTicks: 0, safeRadiusMeters: 20, critChance: 0,
      rngState: 42, enraged: false, bossAbilityTimers: {}, bossAbilityQueue: [], zones: [],
    });
  });

  test.each([0, 1, 2, 6])('rejects a party of %i players', (count) => {
    const config: EncounterConfig = {
      players: Array.from({ length: count }, (_, index) => ({ id: `p${index}`, classId: 'eagle' })),
      critChance: 0,
    };
    expect(() => createEncounter(config, 42)).toThrow();
  });

  test('initializes class stats from data and normalized facing toward the boss', () => {
    const state = createEncounter(createConfig(5), 42);
    for (const { id, classId } of players) {
      const player = getPlayer(state, id);
      const definition = CLASSES[classId];
      expect(player).toMatchObject({
        classId, health: definition.maxHealth, maxHealth: definition.maxHealth,
        mana: definition.maxMana, maxMana: definition.maxMana, armorBps: definition.armorBps,
        bodyRadiusMeters: COMBAT_RULES.playerBodyRadiusMeters,
        speedMetersPerSecond: COMBAT_RULES.playerSpeedMetersPerSecond,
      });
      const distance = Math.hypot(player.x, player.y);
      expect(player.facing.x).toBeCloseTo(-player.x / distance);
      expect(player.facing.y).toBeCloseTo(-player.y / distance);
      expect(Math.hypot(player.facing.x, player.facing.y)).toBeCloseTo(1);
    }
  });

  test('uses the default critical chance when omitted and preserves explicit zero', () => {
    expect(createEncounter({ players: createConfig().players }, 42).critChance).toBe(0.10);
    expect(createEncounter(createConfig(), 42).critChance).toBe(0);
  });
});

describe('T1.2 clock and movement', () => {
  test('same seed and inputs yield identical state after 200 ticks', () => {
    let first = createEncounter(createConfig(), 42);
    let second = createEncounter(createConfig(), 42);
    for (let tick = 0; tick < 200; tick += 1) {
      const inputs = tickInputs(tick);
      first = step(first, inputs, 50).state;
      second = step(second, inputs, 50).state;
    }
    expect(first).toEqual(second);
    expect(first.tick).toBe(200);
  });

  test('reordering inputs between players yields identical state after 200 ticks', () => {
    let first = createEncounter(createConfig(), 42);
    let second = createEncounter(createConfig(), 42);
    for (let tick = 0; tick < 200; tick += 1) {
      const inputs = tickInputs(tick);
      const reordered = ['p2', 'p1', 'p3'].flatMap((id) => inputs.filter((input) => input.playerId === id));
      first = step(first, inputs, 50).state;
      second = step(second, reordered, 50).state;
    }
    expect(first).toEqual(second);
  });

  test.each([
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 3, dy: 4 },
    { dx: -3, dy: -4 },
    { dx: 1, dy: 1 },
  ])('the player center never crosses the wall when pushing ($dx, $dy)', ({ dx, dy }) => {
    let state = createEncounter(createConfig(), 42);
    for (let tick = 0; tick < 1000; tick += 1) {
      state = step(state, [{ playerId: 'p1', type: 'move', dx, dy }], 50).state;
      const player = getPlayer(state);
      expect(Math.hypot(player.x, player.y)).toBeLessThanOrEqual(20);
    }
    const player = getPlayer(state);
    expect(Math.hypot(player.x, player.y)).toBeCloseTo(20, 12);
    expect(player.facing.x).toBeCloseTo(dx / Math.hypot(dx, dy));
    expect(player.facing.y).toBeCloseTo(dy / Math.hypot(dx, dy));
  });

  test.each([49, 51])('rejects dtMs = %i', (dtMs) => {
    const state = createEncounter(createConfig(), 42);
    expect(() => step(state, [], dtMs)).toThrow();
  });

  test('step does not mutate the input state or nested objects', () => {
    const state = createEncounter(createConfig(), 42);
    const player = getPlayer(state);
    player.cooldowns.claw = 10;
    player.cast = {
      abilityId: 'remedy', targetId: 'p2', durationTicks: 30, remainingTicks: 20, interruptible: true,
    };
    player.auras.push({
      definition: CLASSES.healer.abilities[2].effect.aura,
      sourceId: 'p2', abilityId: 'copal', remainingTicks: 200, ticksUntilNextEffect: 20,
    });
    const before = structuredClone(state);
    const inputs = tickInputs(0);
    const inputsBefore = structuredClone(inputs);
    freezeDeep(state);
    freezeDeep(inputs);

    const result = step(state, inputs, 50);
    expect(state).toEqual(before);
    expect(inputs).toEqual(inputsBefore);
    expect(result.state).not.toBe(state);
    expect(getPlayer(result.state)).not.toBe(player);
    expect(result.state.tick).toBe(1);
    expect(getPlayer(result.state).x).not.toBe(player.x);
  });

  test('normalizes movement to 0.35 meters per tick and updates facing', () => {
    const state = createEncounter(createConfig(), 42);
    const before = getPlayer(state);
    const result = step(state, [{ playerId: 'p1', type: 'move', dx: 3, dy: 4 }], 50);
    const after = getPlayer(result.state);
    expect(after.x).toBeCloseTo(before.x + 0.21, 12);
    expect(after.y).toBeCloseTo(before.y + 0.28, 12);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeCloseTo(0.35, 12);
    expect(after.facing).toEqual({ x: 0.6, y: 0.8 });
  });

  test('the last move from a player is applied exactly once', () => {
    const state = createEncounter(createConfig(), 42);
    const result = step(state, [
      { playerId: 'p1', type: 'move', dx: 0, dy: -1 },
      { playerId: 'p2', type: 'move', dx: 0, dy: 1 },
      { playerId: 'p1', type: 'move', dx: 1, dy: 0 },
    ], 50);
    expect(getPlayer(result.state)).toMatchObject({
      x: -1.65, y: -15, facing: { x: 1, y: 0 },
    });
    expect(getPlayer(result.state, 'p2').y).toBeCloseTo(-14.65, 12);
  });

  test('zero movement and absent input preserve position and the last nonzero facing', () => {
    const initial = createEncounter(createConfig(), 42);
    const moving = step(initial, [{ playerId: 'p1', type: 'move', dx: -1, dy: 0 }], 50).state;
    const stopped = step(moving, [{ playerId: 'p1', type: 'move', dx: 0, dy: 0 }], 50).state;
    const idle = step(stopped, [], 50).state;
    expect(getPlayer(stopped)).toEqual(getPlayer(moving));
    expect(getPlayer(idle)).toEqual(getPlayer(moving));
    expect(getPlayer(idle).facing).toEqual({ x: -1, y: 0 });
    expect(idle.tick).toBe(3);
  });

  test('enemy and unknown movement inputs are ignored and pull remains inactive', () => {
    const state = createEncounter(createConfig(), 42);
    const result = step(state, [
      { playerId: BOSS.id, type: 'move', dx: 1, dy: 0 },
      { playerId: 'missing', type: 'move', dx: 1, dy: 0 },
    ], 50);
    expect(result).toEqual({ state: { ...state, tick: 1 }, events: [] });
  });
});
