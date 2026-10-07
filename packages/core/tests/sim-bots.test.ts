import { expect, test } from 'vitest';
import { BOSS, BOSS_ABILITIES, CLASSES, COMBAT_RULES, createEncounter, step } from '../src/index.js';
import type { CombatEvent, EncounterState, EnemyEntity, Input, PlayerEntity } from '../src/index.js';
import { createBotParty, getBotInputs } from '../sim/bots.js';
import { freezeCombat } from './combat-fixtures.js';

function fixture(): EncounterState {
  const state = createEncounter({ players: createBotParty(3), critChance: 0 }, 42);
  state.bossActive = true;
  Object.assign(state.entities['player:1'], { x: 5.5, y: 0 });
  Object.assign(state.entities['player:2'], { x: 16.5, y: 0 });
  Object.assign(state.entities['player:3'], { x: 0, y: 16.5 });
  return state;
}

function player(state: EncounterState, id: string): PlayerEntity {
  const entity = state.entities[id];
  if (entity.type !== 'player') throw new Error('Se esperaba un jugador.');
  return entity;
}

function boss(state: EncounterState): EnemyEntity {
  const entity = state.entities[BOSS.id];
  if (entity.type !== 'boss') throw new Error('Se esperaba el jefe.');
  return entity;
}

function inputsFor(state: EncounterState, id: string): Input[] {
  return getBotInputs(state).filter((input) => input.playerId === id);
}

function addWind(state: EncounterState, x: number, y: number): void {
  const wind = BOSS_ABILITIES.obsidianWind.effect;
  state.zones = [{ id: 'wind:test', sourceId: BOSS.id, abilityId: 'obsidianWind', x, y,
    radiusMeters: wind.radiusMeters, remainingTicks: wind.warningTicks, baseDamage: wind.baseDamage }];
}

function applyCopal(state: EncounterState): void {
  const aura = CLASSES.healer.abilities[2].effect.aura;
  for (const entity of Object.values(state.entities).filter((entity) => entity.type === 'player')) {
    entity.auras = [{ definition: aura, sourceId: 'player:2', abilityId: 'copal',
      remainingTicks: aura.durationTicks, ticksUntilNextEffect: aura.firstTickDelayTicks }];
  }
}

test.each([3, 4, 5] as const)('creates the required composition for %s players', (count) => {
  expect(createBotParty(count).map(({ classId }) => classId)).toEqual([
    'jaguar', 'healer', ...Array.from({ length: count - 2 }, () => 'eagle'),
  ]);
  expect(new Set(createBotParty(count).map(({ id }) => id)).size).toBe(count);
});

test('the tank selects and approaches the boss, initiating the proximity pull', () => {
  let state = createEncounter({ players: createBotParty(3) }, 1);
  for (let tick = 0; tick < 100 && !state.bossActive; tick += 1) {
    const inputs = getBotInputs(state);
    expect(inputs.every((input) => input.playerId === 'player:1')).toBe(true);
    expect(inputs.some((input) => input.type === 'cast')).toBe(false);
    state = step(state, inputs, COMBAT_RULES.tickDurationMs).state;
  }
  expect(state.bossActive).toBe(true);
  expect(state.entities['player:1'].targetId).toBe(BOSS.id);
  expect(state.entities[BOSS.id].health).toBe(state.entities[BOSS.id].maxHealth);
});

test.each(['player:1', 'player:2', 'player:3'])('C3: %s escapes a Wind circle without its damage', (id) => {
  let state = fixture();
  const marked = player(state, id);
  addWind(state, marked.x, marked.y);
  const events: CombatEvent[] = [];
  for (let tick = 0; tick < BOSS_ABILITIES.obsidianWind.effect.warningTicks; tick += 1) {
    freezeCombat(state);
    const inputs = getBotInputs(state);
    if (tick === 0) {
      expect(inputs.filter((input) => input.playerId === id).map(({ type }) => type)).toEqual(['move']);
    }
    const result = step(state, inputs, COMBAT_RULES.tickDurationMs);
    state = result.state;
    events.push(...result.events);
  }
  expect(state.zones).toEqual([]);
  expect(state.entities[id].health).toBeGreaterThan(0);
  expect(events.filter((event) => event.type === 'damage'
    && event.abilityId === 'obsidianWind' && event.targetId === id)).toEqual([]);
});

test('Wind avoidance includes the one meter margin and moves away from the zone center', () => {
  const state = fixture();
  addWind(state, 11.5, 0);
  expect(inputsFor(state, 'player:2')).toEqual([{ playerId: 'player:2', type: 'move', dx: 1, dy: 0 }]);
});

test.each(['player:1', 'player:2', 'player:3'])('%s moves inward at the safe margin and outside the safe radius', (id) => {
  for (const x of [11, 13]) {
    const state = fixture();
    state.safeRadiusMeters = 12;
    Object.assign(state.entities[id], { x, y: 0 });
    expect(inputsFor(state, id)).toEqual([{ playerId: id, type: 'move', dx: -1, dy: 0 }]);
  }
});

test('tank shields a targeted Strike, taunts other targets, roars at xolos and uses Claw', () => {
  const state = fixture();
  const tankId = 'player:1';
  expect(inputsFor(state, tankId)).toContainEqual({ playerId: tankId, type: 'cast', abilityId: 'claw' });
  boss(state).cast = { abilityId: 'flayedStrike', targetId: tankId, durationTicks: 50,
    remainingTicks: 50, interruptible: false };
  expect(inputsFor(state, tankId)).toContainEqual({ playerId: tankId, type: 'cast', abilityId: 'obsidianShield' });
  boss(state).cast = null;
  boss(state).targetId = 'player:2';
  expect(inputsFor(state, tankId)).toContainEqual({ playerId: tankId, type: 'cast', abilityId: 'taunt' });
  boss(state).targetId = tankId;
  state.entities.xolo = { ...boss(state), id: 'xolo', type: 'xolo', x: 13.5, bodyRadiusMeters: 0.5,
    targetId: 'player:2' };
  expect(inputsFor(state, tankId)).toContainEqual({ playerId: tankId, type: 'target', entityId: 'xolo' });
  player(state, tankId).cooldowns.taunt = 10;
  expect(inputsFor(state, tankId)).toContainEqual({ playerId: tankId, type: 'cast', abilityId: 'roar' });
});

test('healer selects the lowest absolute health without Copal, then lowest health ratio for Remedio', () => {
  const state = fixture();
  state.entities['player:1'].health = 800;
  state.entities['player:3'].health = 680;
  expect(inputsFor(state, 'player:2')).toEqual([
    { playerId: 'player:2', type: 'target', entityId: 'player:3' },
    { playerId: 'player:2', type: 'cast', abilityId: 'copal' },
  ]);
  applyCopal(state);
  expect(inputsFor(state, 'player:2')).toEqual([
    { playerId: 'player:2', type: 'target', entityId: 'player:1' },
    { playerId: 'player:2', type: 'cast', abilityId: 'remedy' },
  ]);
});

test('healer uses Great Remedio below 50% and Offering for two allies below 70%', () => {
  const state = fixture();
  state.entities['player:1'].health = 500;
  expect(inputsFor(state, 'player:2')).toContainEqual({ playerId: 'player:2', type: 'cast', abilityId: 'greatRemedy' });
  state.entities['player:3'].health = 500;
  expect(inputsFor(state, 'player:2')).toEqual([{ playerId: 'player:2', type: 'cast', abilityId: 'offering' }]);
});

test('damage prioritizes Lament, living xolos, Quick Shot and then Arrow', () => {
  const state = fixture();
  const eagleId = 'player:3';
  state.entities.xolo = { ...boss(state), type: 'xolo', id: 'xolo' };
  expect(inputsFor(state, eagleId)).toEqual([
    { playerId: eagleId, type: 'target', entityId: 'xolo' },
    { playerId: eagleId, type: 'cast', abilityId: 'quickShot' },
  ]);
  player(state, eagleId).cooldowns.quickShot = 10;
  expect(inputsFor(state, eagleId)).toContainEqual({ playerId: eagleId, type: 'cast', abilityId: 'obsidianArrow' });
  boss(state).cast = { abilityId: 'lamentOfTheDead', targetId: null, durationTicks: 60,
    remainingTicks: 60, interruptible: true };
  expect(inputsFor(state, eagleId)).toEqual([
    { playerId: eagleId, type: 'target', entityId: BOSS.id },
    { playerId: eagleId, type: 'cast', abilityId: 'warCry' },
  ]);
  boss(state).cast = null;
  state.entities.xolo.health = 0;
  expect(inputsFor(state, eagleId)).toContainEqual({ playerId: eagleId, type: 'target', entityId: BOSS.id });
});

test('bots are pure, deterministic, independent of entity insertion order and skip dead players', () => {
  const state = fixture();
  state.entities['player:2'].health = 0;
  freezeCombat(state);
  const inputs = getBotInputs(state);
  expect(getBotInputs(state)).toEqual(inputs);
  expect(getBotInputs({ ...state, entities: Object.fromEntries(Object.entries(state.entities).reverse()) })).toEqual(inputs);
  expect(inputs.some((input) => input.playerId === 'player:2')).toBe(false);
  expect(getBotInputs({ ...state, status: 'victory' })).toEqual([]);
  expect(getBotInputs({ ...state, status: 'defeat' })).toEqual([]);
});
