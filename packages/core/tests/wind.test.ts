import { expect, test } from 'vitest';
import { BOSS, BOSS_ABILITIES } from '../src/data/boss.js';
import { createEncounter } from '../src/encounter.js';
import { advanceWindZones, createWindZones } from '../src/mechanics/wind.js';
import { nextRandom } from '../src/rng.js';
import type { EncounterState } from '../src/types.js';
import { combatCast, combatEncounter, combatTick, freezeCombat } from './combat-fixtures.js';
import { repeatTick } from './enemy-fixtures.js';

const wind = BOSS_ABILITIES.obsidianWind.effect;

function markWind(state: EncounterState): ReturnType<typeof combatTick> {
  return combatTick({ ...state, bossActive: true, bossAbilityTimers: { obsidianWind: 1 } });
}

test('C1: leaving before two seconds avoids damage; two overlapping circles deal 400', () => {
  const initial = combatEncounter();
  Object.assign(initial.entities.p1, { x: 10, y: -15 });
  Object.assign(initial.entities.p2, { x: 0, y: -15 });
  Object.assign(initial.entities.p3, { x: 0, y: -15 });
  freezeCombat(initial);
  const marked = markWind(initial);
  expect(marked.state.zones).toHaveLength(3);
  expect(marked.state.zones.every((zone) => zone.remainingTicks === wind.warningTicks)).toBe(true);
  const positions = marked.state.zones.map(({ x, y }) => ({ x, y }));
  let state = marked.state;
  for (let offset = 1; offset < wind.warningTicks; offset += 1) {
    const result = combatTick(state, [{ type: 'move', playerId: 'p1', dx: -1, dy: 1 }]);
    expect(result.events.filter((event) => event.type === 'damage')).toEqual([]);
    expect(result.state.zones.map(({ x, y }) => ({ x, y }))).toEqual(positions);
    state = result.state;
  }
  const exploded = combatTick(state);
  expect(exploded.state.zones).toEqual([]);
  expect(exploded.state.entities.p1.health).toBe(initial.entities.p1.health);
  expect(exploded.state.entities.p2.health).toBe(initial.entities.p2.health - 400);
  expect(exploded.state.entities.p3.health).toBe(initial.entities.p3.health - 400);
  expect(exploded.events.filter((event) => event.type === 'damage')).toHaveLength(4);
  expect(exploded.events.every((event) => event.tick === marked.state.tick + wind.warningTicks)).toBe(true);
});

test.each([{ living: 2, expected: 2 }, { living: 5, expected: 3 }])(
  'C2: $living living players produce $expected distinct marks', ({ living, expected }) => {
    const initial = createEncounter({ critChance: 0, players: ['a', 'b', 'c', 'd', 'e']
      .map((id) => ({ id, classId: 'eagle' as const })) }, 123);
    for (const id of ['a', 'b', 'c', 'd', 'e'].slice(living)) initial.entities[id].health = 0;
    freezeCombat(initial);
    const result = markWind(initial);
    expect(result.state.zones).toHaveLength(expected);
    expect(new Set(result.state.zones.map((zone) => zone.id)).size).toBe(expected);
    expect(new Set(result.state.zones.map((zone) => zone.x)).size).toBe(expected);
    for (const zone of result.state.zones) {
      expect(Object.values(initial.entities).some((entity) => entity.type === 'player'
        && entity.health > 0 && entity.x === zone.x && entity.y === zone.y)).toBe(true);
    }
  },
);

test('C5: seeded selection is reproducible, consumes state RNG and ignores insertion order', () => {
  const initial = createEncounter({ critChance: 0, players: ['e', 'a', 'd', 'b', 'c']
    .map((id) => ({ id, classId: 'eagle' as const })) }, 93);
  const reordered = { ...initial, entities: Object.fromEntries(Object.entries(initial.entities).reverse()) };
  freezeCombat(initial);
  const first = markWind(initial);
  expect(first).toEqual(markWind(initial));
  expect(first).toEqual(markWind(reordered));
  let rngState = initial.rngState;
  const candidates = ['a', 'b', 'c', 'd', 'e'];
  const selected: string[] = [];
  for (let index = 0; index < wind.maxTargets; index += 1) {
    const roll = nextRandom(rngState);
    rngState = roll.rngState;
    selected.push(...candidates.splice(Math.floor(roll.value * candidates.length), 1));
  }
  expect(first.state.rngState).toBe(rngState);
  expect(first.state.zones.map((zone) => zone.x)).toEqual(selected.map((id) => initial.entities[id].x));
});

test.each([wind.radiusMeters, wind.radiusMeters + 0.01])('Wind tests centers at distance %s', (distance) => {
  const initial = combatEncounter();
  const marked = createWindZones(initial, BOSS.id);
  const zone = { ...marked.zones[0], x: 0, y: 0, remainingTicks: 1 };
  const state: EncounterState = { ...initial, zones: [zone], entities: { ...initial.entities,
    p3: { ...initial.entities.p3, x: distance, y: 0 } } };
  freezeCombat(state);
  const result = advanceWindZones(state);
  expect(result.state.entities.p3.health).toBe(initial.entities.p3.health - (distance === wind.radiusMeters ? 200 : 0));
  expect(result.state.entities.p1).toBe(state.entities.p1);
  expect(result.state.entities.p2).toBe(state.entities.p2);
  expect(result.state.entities.boss).toBe(state.entities.boss);
  expect(state.zones).toEqual([zone]);
});

test('movement on the explosion tick is processed before Wind', () => {
  const initial = combatEncounter();
  const zone = { ...createWindZones(initial, BOSS.id).zones[0], x: 0, y: -15, remainingTicks: 1 };
  const state = { ...initial, zones: [zone], entities: { ...initial.entities,
    p3: { ...initial.entities.p3, x: wind.radiusMeters, y: -15 } } };
  const result = combatTick(state, [{ type: 'move', playerId: 'p3', dx: 1, dy: 0 }]);
  expect(result.state.entities.p3.health).toBe(initial.entities.p3.health);
  expect(result.state.zones).toEqual([]);
});

test.each(['phase', 'death'])('marked Wind explodes after boss %s', (change) => {
  const initial = combatEncounter();
  const marked = markWind(initial);
  const changed = { ...marked.state, entities: { ...marked.state.entities,
    boss: { ...marked.state.entities.boss, health: change === 'death' ? 0 : 7200 } } };
  const result = repeatTick(changed, wind.warningTicks);
  expect(result.state.zones).toEqual([]);
  expect(result.events.some((event) => event.type === 'damage' && event.abilityId === 'obsidianWind')).toBe(true);
  if (change === 'phase') expect(result.state.phase).toBe(3);
});

test('Wind uses armor, a real Shield and enrage activated on its explosion tick', () => {
  const initial = combatEncounter();
  Object.assign(initial.entities.p1, { x: 10, y: -15 });
  const shielded = combatTick(initial, [combatCast('obsidianShield', 'p1')]).state;
  const marked = markWind(shielded).state;
  const state = { ...marked, elapsedTicks: BOSS.enrage.afterTicks - 1,
    zones: marked.zones.map((zone) => ({ ...zone, remainingTicks: 1 })) };
  const result = combatTick(state);
  expect(result.events).toContainEqual({ type: 'damage', tick: state.tick + 1,
    sourceId: BOSS.id, abilityId: 'obsidianWind', targetId: 'p1', amount: 350, critical: false });
  expect(result.events[0]).toMatchObject({ type: 'enraged' });
});

test('Wind marking preserves entity references; dead players are skipped and empty zones are inert', () => {
  const initial = combatEncounter();
  freezeCombat(initial);
  const marked = createWindZones(initial, BOSS.id);
  expect(marked.entities).toBe(initial.entities);
  expect(advanceWindZones(initial).state).toBe(initial);
  const dead = { ...initial, entities: Object.fromEntries(Object.entries(initial.entities)
    .map(([id, entity]) => [id, { ...entity, health: 0 }])) };
  expect(createWindZones(dead, BOSS.id)).toBe(dead);
  const result = advanceWindZones({ ...dead, zones: marked.zones.map((zone) => ({ ...zone, remainingTicks: 1 })) });
  expect(result.events).toEqual([]);
  expect(result.state.entities).toBe(dead.entities);
});
