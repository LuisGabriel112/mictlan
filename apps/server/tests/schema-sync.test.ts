import { expect, test, vi } from 'vitest';
import { BOSS, type EnemyEntity } from '@mictlan/core';
import { LobbyState } from '../src/schema/LobbyState.js';
import { syncEncounter } from '../src/schema/sync.js';
import { activeFixture, auraFixture, castFixture, encounterFixture, zoneFixture } from './schema-fixture.js';

test('syncEncounter initializes every entity field and documents absent optional values', () => {
  const encounter = encounterFixture();
  const view = new LobbyState();
  syncEncounter(view, encounter);
  expect(view.entities.size).toBe(4);
  expect(view.entities.get('boss')).toMatchObject({ id: 'boss', type: 'boss', classId: '', x: 0, y: 0,
    health: BOSS.maxHealthByPlayerCount[3], maxHealth: BOSS.maxHealthByPlayerCount[3], mana: 0, maxMana: 0, targetId: '' });
  expect(view.entities.get('tank')).toMatchObject({ type: 'player', classId: 'jaguar', mana: 0, maxMana: 0 });
  expect(view.entities.get('healer')).toMatchObject({ classId: 'healer', mana: 1000, maxMana: 1000 });
  expect(view.entities.get('healer')?.cast).toBeUndefined();
  expect(view.entities.get('healer')?.auras.size).toBe(0);
});

test('syncEncounter copies encounter metadata and preserves lobby fields and independent maps', () => {
  const view = new LobbyState({ code: 'ABCD' });
  syncEncounter(view, { ...encounterFixture(), phase: 3, safeRadiusMeters: 12.5, tick: 70,
    elapsedTicks: 60, status: 'victory' });
  expect(view).toMatchObject({ code: 'ABCD', phase: 3, safeRadiusMeters: 12.5, tick: 70,
    elapsedTicks: 60, status: 'victory' });
  expect(view.players.size).toBe(0);
  expect(new LobbyState().entities.size).toBe(0);
  expect(new LobbyState().zones.size).toBe(0);
});

test('entityFields updates health, coordinates, resources and target without mutating core', () => {
  const encounter = encounterFixture();
  const view = new LobbyState();
  syncEncounter(view, encounter);
  const healer = view.entities.get('healer');
  const changed = { ...encounter, entities: { ...encounter.entities, healer: {
    ...encounter.entities.healer, health: 300, maxHealth: 800, x: 3.5, y: -8.25, targetId: 'tank',
    mana: 800.9, maxMana: 1100,
  } } };
  const original = structuredClone(changed);
  syncEncounter(view, changed);
  expect(view.entities.get('healer')).toBe(healer);
  expect(healer).toMatchObject({ health: 300, maxHealth: 800, x: 3.5, y: -8.25,
    mana: 800.9, maxMana: 1100, targetId: 'tank' });
  expect(changed).toEqual(original);
  expect(encounter.entities.healer.health).toBe(700);
});

test('syncCast creates a cast, updates every field in place and removes it', () => {
  const encounter = activeFixture();
  const view = new LobbyState();
  syncEncounter(view, encounter);
  const cast = view.entities.get('healer')!.cast;
  expect(cast).toMatchObject(castFixture());
  encounter.entities.healer.cast = castFixture({ abilityId: 'lamentOfTheDead', targetId: null,
    durationTicks: 60, remainingTicks: 19, interruptible: true });
  syncEncounter(view, encounter);
  expect(view.entities.get('healer')!.cast).toBe(cast);
  expect(cast).toMatchObject({ abilityId: 'lamentOfTheDead', targetId: '', durationTicks: 60,
    remainingTicks: 19, interruptible: true });
  encounter.entities.healer.cast = null;
  syncEncounter(view, encounter);
  expect(view.entities.get('healer')!.cast).toBeUndefined();
});

test('syncEntity keys auras by definition id, refreshes them in place and removes them', () => {
  const encounter = activeFixture();
  const view = new LobbyState();
  syncEncounter(view, encounter);
  const aura = view.entities.get('healer')!.auras.get('obsidianShield');
  expect(aura).toMatchObject({ id: 'obsidianShield', sourceId: 'tank', remainingTicks: 100 });
  encounter.entities.healer.auras = [auraFixture({ sourceId: 'healer', remainingTicks: 99, abilityId: 'copal' })];
  syncEncounter(view, encounter);
  expect(view.entities.get('healer')!.auras.get('obsidianShield')).toBe(aura);
  expect(aura).toMatchObject({ id: 'obsidianShield', sourceId: 'healer', remainingTicks: 99 });
  encounter.entities.healer.auras = [];
  syncEncounter(view, encounter);
  expect(view.entities.get('healer')!.auras.size).toBe(0);
});

test('C3: wind zones and xolos appear, expire or disappear according to core membership', () => {
  const encounter = encounterFixture();
  const view = new LobbyState();
  syncEncounter(view, encounter);
  encounter.entities['xolo:1'] = { ...encounter.entities.boss as EnemyEntity, id: 'xolo:1', type: 'xolo', health: 300 };
  encounter.zones = [zoneFixture()];
  syncEncounter(view, encounter);
  expect(view.entities.get('xolo:1')).toMatchObject({ id: 'xolo:1', type: 'xolo', health: 300 });
  expect(view.zones.get('wind:1')).toMatchObject({ id: 'wind:1', x: 3, y: -7, radiusMeters: 4, remainingTicks: 40 });
  encounter.entities['xolo:1'].health = -5;
  encounter.zones = [];
  syncEncounter(view, encounter);
  expect(view.zones.size).toBe(0);
  expect(view.entities.get('xolo:1')?.health).toBe(-5);
  delete encounter.entities['xolo:1'];
  syncEncounter(view, encounter);
  expect(view.entities.has('xolo:1')).toBe(false);
});

test('syncEncounter updates every zone field without replacing the zone', () => {
  const encounter = activeFixture();
  const view = new LobbyState();
  syncEncounter(view, encounter);
  const zone = view.zones.get('wind:1');
  encounter.zones = [zoneFixture({ x: -2, y: 8, radiusMeters: 5, remainingTicks: 39 })];
  syncEncounter(view, encounter);
  expect(view.zones.get('wind:1')).toBe(zone);
  expect(zone).toMatchObject({ id: 'wind:1', x: -2, y: 8, radiusMeters: 5, remainingTicks: 39 });
});

test('C4: equal entity, cast, aura and zone values cause zero field assignments or map writes', () => {
  const encounter = activeFixture();
  const view = new LobbyState();
  syncEncounter(view, encounter);
  const healer = view.entities.get('healer')!;
  const watched = [healer, healer.cast!, healer.auras.get('obsidianShield')!, view.zones.get('wind:1')!];
  const writes = watched.flatMap((entry) => Object.keys(entry.toJSON()).map((key) =>
    vi.spyOn(entry as unknown as Record<string, unknown>, key, 'set')));
  const maps = [view.entities, view.zones, healer.auras];
  const changes = maps.flatMap((entries) => [vi.spyOn(entries, 'set'), vi.spyOn(entries, 'delete')]);
  syncEncounter(view, { ...structuredClone(encounter), tick: 1 });
  for (const assignment of [...writes, ...changes]) expect(assignment).not.toHaveBeenCalled();
  expect(view.tick).toBe(1);
});

test('players expose their GCD and running cooldowns; finished cooldowns disappear', () => {
  const encounter = encounterFixture();
  const view = new LobbyState();
  const eagle = { ...encounter.entities.eagle, gcdRemainingTicks: 12, cooldowns: { quickShot: 90, flight: 0 } };
  syncEncounter(view, { ...encounter, entities: { ...encounter.entities, eagle } });
  expect(view.entities.get('eagle')?.gcdRemainingTicks).toBe(12);
  expect(view.entities.get('eagle')?.cooldowns.toJSON()).toEqual({ quickShot: { id: 'quickShot', remainingTicks: 90 } });
  const cooled = { ...eagle, gcdRemainingTicks: 0, cooldowns: {} };
  syncEncounter(view, { ...encounter, entities: { ...encounter.entities, eagle: cooled } });
  expect(view.entities.get('eagle')?.gcdRemainingTicks).toBe(0);
  expect(view.entities.get('eagle')?.cooldowns.size).toBe(0);
  expect(view.entities.get('boss')?.cooldowns.size).toBe(0);
});
