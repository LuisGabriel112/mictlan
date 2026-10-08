import { BOSS } from '@mictlan/core';
import { afterEach, expect, test, vi } from 'vitest';
import { IntegrationServer } from './integration-fixture.js';

let server: IntegrationServer;

async function startEagleCombat() {
  server = new IntegrationServer('1', { critChance: 0 });
  await server.start();
  const eagle = await server.create();
  eagle.send('ready', { classId: 'eagle' });
  await vi.waitFor(() => expect(eagle.state.status).toBe('combat'));
  return { eagle, room: () => server.room(eagle.roomId) };
}

afterEach(async () => {
  await server?.stop();
});

test('C1: an eagle in range casts Obsidian Arrow and the boss loses exactly 140', async () => {
  const { eagle, room } = await startEagleCombat();
  eagle.send('target', { entityId: 'boss' });
  eagle.send('cast', { abilityId: 'obsidianArrow' });
  await vi.waitFor(() => expect(room().encounter?.entities.boss.health).toBeLessThan(BOSS.maxHealthByPlayerCount[3]), { timeout: 4000 });
  expect(room().encounter?.entities.boss.health).toBe(BOSS.maxHealthByPlayerCount[3] - 140);
});

test('C2: malformed messages are ignored and the room keeps advancing', async () => {
  const { eagle, room } = await startEagleCombat();
  const garbage: [string, unknown][] = [
    ['move', { dx: Number.NaN, dy: 1 }], ['move', 'north'], ['move', { dx: 'a', dy: 0 }],
    ['target', { entityId: 42 }], ['target', { entityId: 'missing' }], ['cast', { abilityId: 'fireball' }],
    ['cast', null], ['move', { dx: 30, dy: 40 }],
  ];
  for (const [type, payload] of garbage) eagle.send(type, payload);
  const before = room().encounter?.tick ?? 0;
  await vi.waitFor(() => expect(room().encounter?.tick).toBeGreaterThan(before + 5));
  const player = room().encounter?.entities[eagle.sessionId];
  expect(Number.isFinite(player?.x)).toBe(true);
  expect(Number.isFinite(player?.y)).toBe(true);
});

test('C4: the loop advances one tick per 50 ms of real time', async () => {
  const { room } = await startEagleCombat();
  const startTick = room().encounter?.tick ?? 0;
  const startedAt = performance.now();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const elapsedTicks = (room().encounter?.tick ?? 0) - startTick;
  const expectedTicks = Math.round((performance.now() - startedAt) / 50);
  expect(Math.abs(elapsedTicks - expectedTicks)).toBeLessThanOrEqual(2);
  expect(Math.abs(elapsedTicks - 20)).toBeLessThanOrEqual(2);
});
