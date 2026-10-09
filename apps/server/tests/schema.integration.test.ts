import { afterEach, expect, test, vi } from 'vitest';
import { BOSS, type CombatEvent } from '@mictlan/core';
import { IntegrationServer } from './integration-fixture.js';

let server: IntegrationServer;
type Connection = Awaited<ReturnType<IntegrationServer['create']>>;

async function connectedParty() {
  server = new IntegrationServer('1', { critChance: 0 });
  await server.start();
  const eagle = await server.create();
  const healer = await server.join(eagle.roomId);
  const batches: CombatEvent[][][] = [[], []];
  eagle.onMessage<CombatEvent[]>('events', (events) => batches[0].push(events));
  healer.onMessage<CombatEvent[]>('events', (events) => batches[1].push(events));
  eagle.send('ready', { classId: 'eagle' });
  healer.send('ready', { classId: 'healer' });
  await vi.waitFor(() => expect(eagle.state.status).toBe('combat'));
  return { eagle, healer, batches };
}

async function moveAndTakeDamage(eagle: Connection): Promise<void> {
  const previousX = eagle.state.entities.get(eagle.sessionId)!.x;
  eagle.send('move', { dx: 1, dy: 0 });
  await vi.waitFor(() => expect(eagle.state.entities.get(eagle.sessionId)!.x).toBeGreaterThan(previousX));
  // Moves are held until released (SPEC §7), and casting requires standing still.
  eagle.send('move', { dx: 0, dy: 0 });
  eagle.send('target', { entityId: 'boss' });
  eagle.send('cast', { abilityId: 'quickShot' });
  await vi.waitFor(() => expect(eagle.state.entities.get(eagle.sessionId)!.health).toBeLessThan(750), { timeout: 10000 });
}

async function observeCastProgress(eagle: Connection): Promise<void> {
  eagle.send('cast', { abilityId: 'obsidianArrow' });
  await vi.waitFor(() => expect(eagle.state.entities.get(eagle.sessionId)?.cast?.abilityId).toBe('obsidianArrow'));
  const cast = eagle.state.entities.get(eagle.sessionId)!.cast!;
  const previous = cast.remainingTicks;
  expect(cast).toMatchObject({ targetId: 'boss', durationTicks: 30, interruptible: false });
  await vi.waitFor(() => expect(eagle.state.entities.get(eagle.sessionId)!.cast!.remainingTicks).toBeLessThan(previous));
  await vi.waitFor(() => expect(eagle.state.entities.get(eagle.sessionId)?.cast).toBeUndefined(), { timeout: 4000 });
  // Arrow 140 + Disparo veloz 70, plus whole SPEC §11 auto-attacks of 15.
  const lost = BOSS.maxHealthByPlayerCount[3] - eagle.state.entities.get('boss')!.health;
  expect(lost).toBeGreaterThanOrEqual(210);
  expect((lost - 210) % 15).toBe(0);
}

afterEach(async () => {
  await server?.stop();
});

test('C1: the client observes health, position, cast progress and auras on the same entity', async () => {
  const { eagle, healer } = await connectedParty();
  await moveAndTakeDamage(eagle);
  healer.send('target', { entityId: eagle.sessionId });
  healer.send('cast', { abilityId: 'copal' });
  await vi.waitFor(() => expect(eagle.state.entities.get(eagle.sessionId)?.auras.get('copal')).toBeDefined());
  const aura = eagle.state.entities.get(eagle.sessionId)!.auras.get('copal')!;
  expect(aura).toMatchObject({ id: 'copal', sourceId: healer.sessionId });
  const previous = aura.remainingTicks;
  await vi.waitFor(() => expect(aura.remainingTicks).toBeLessThan(previous));
  await observeCastProgress(eagle);
  // Under CPU load the loop drops late ticks, so game time can lag behind wall-clock time.
}, 20000);

test('C2: every client receives an events array with damage sourceId and abilityId', async () => {
  const { eagle, batches } = await connectedParty();
  eagle.send('target', { entityId: 'boss' });
  eagle.send('cast', { abilityId: 'quickShot' });
  const damage = { type: 'damage', sourceId: eagle.sessionId, abilityId: 'quickShot', targetId: 'boss', amount: 70 };
  for (const received of batches) {
    await vi.waitFor(() => expect(received.flat()).toEqual(expect.arrayContaining([expect.objectContaining(damage)])));
    expect(received.every(Array.isArray)).toBe(true);
  }
  expect(batches[0][0]).toEqual(batches[1][0]);
});
