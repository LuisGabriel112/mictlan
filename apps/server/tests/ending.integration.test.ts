import { expect, onTestFinished, test, vi } from 'vitest';
import { matchMaker } from '@colyseus/core';
import type { ClassId } from '@mictlan/core';
import { IntegrationServer } from './integration-fixture.js';
import { connectedEndingParty, expectCleanLobby, expectTimedReturn, leaveClient } from './ending-integration-fixture.js';

test('C1: victory is synchronized for five seconds before a clean unlocked lobby and a new encounter', async () => {
  const classes: ClassId[] = ['eagle', 'healer'];
  const party = await connectedEndingParty(classes, { initialBossHealth: 1 });
  const [eagle] = party.clients;
  eagle.send('target', { entityId: 'boss' });
  eagle.send('cast', { abilityId: 'quickShot' });
  await expectTimedReturn(party, 'victory');
  party.clients.forEach((client) => expectCleanLobby(client.state, classes));
  expect(party.batches[0].filter(({ type }) => type === 'encounterEnded')).toHaveLength(1);
  const joined = await party.server.join(eagle.roomId);
  joined.onMessage('events', () => undefined);
  party.clients.forEach((client, index) => client.send('ready', { classId: classes[index] }));
  joined.send('ready', { classId: 'jaguar' });
  await vi.waitFor(() => expect(eagle.state.status).toBe('combat'));
  expect(party.room.encounter?.entities.boss.health).toBe(1);
  expect(party.room.encounter?.elapsedTicks).toBe(0);
}, 10000);

test('C2: removing the sole dev player produces defeat on the next step and returns to lobby', async () => {
  const party = await connectedEndingParty(['eagle']);
  const [eagle] = party.clients;
  party.room['session']!.disconnect(eagle.sessionId);
  expect(party.room.encounter?.entities[eagle.sessionId].health).toBe(0);
  await expectTimedReturn(party, 'defeat');
  expectCleanLobby(eagle.state, ['eagle']);
  expect(party.batches[0].filter(({ type }) => type === 'encounterEnded')).toEqual([
    expect.objectContaining({ type: 'encounterEnded', outcome: 'defeat' }),
  ]);
}, 10000);

test('C3: survivors receive disconnect death and continue advancing mid-fight', async () => {
  const party = await connectedEndingParty(['eagle', 'healer', 'jaguar']);
  const [eagle, healer] = party.clients;
  const before = party.room.encounter!.tick;
  await leaveClient(party.server, eagle);
  await vi.waitFor(() => expect(healer.state.entities.get(eagle.sessionId)?.health).toBe(0));
  const death = expect.objectContaining({ type: 'death', entityId: eagle.sessionId,
    sourceId: eagle.sessionId, abilityId: 'disconnect' });
  for (const received of party.batches.slice(1)) {
    expect(received.filter(({ type }) => type === 'death')).toEqual([death]);
  }
  expect(healer.state.players.has(eagle.sessionId)).toBe(false);
  await vi.waitFor(() => expect(healer.state.tick).toBeGreaterThan(before + 2));
  expect(healer.state.status).toBe('combat');
});

test('C5: a valid ready party remains in lobby after an unready departure until another ready', async () => {
  const server = new IntegrationServer();
  onTestFinished(() => server.stop());
  await server.start();
  const leader = await server.create();
  for (let index = 0; index < 3; index += 1) await server.join(leader.roomId);
  server.clients.forEach((client) => client.onMessage('events', () => undefined));
  const classes = ['jaguar', 'healer', 'eagle'];
  classes.forEach((classId, index) => server.clients[index].send('ready', { classId }));
  await vi.waitFor(() => expect([...leader.state.players.values()].filter(({ ready }) => ready)).toHaveLength(3));
  await leaveClient(server, server.clients[3]);
  await vi.waitFor(() => expect(leader.state.players.size).toBe(3));
  expect(leader.state.status).toBe('lobby');
  expect(server.room(leader.roomId).encounter).toBeUndefined();
  leader.send('ready', { classId: 'jaguar' });
  await vi.waitFor(() => expect(leader.state.status).toBe('combat'));
});

test.each(['lobby', 'combat', 'victory'] as const)('an empty %s room is disposed and its code becomes reusable', async (status) => {
  const party = await connectedEndingParty(['eagle'], { initialBossHealth: 1 });
  const [eagle] = party.clients;
  if (status !== 'combat') {
    eagle.send('target', { entityId: 'boss' });
    eagle.send('cast', { abilityId: 'quickShot' });
    await vi.waitFor(() => expect(eagle.state.status).toBe('victory'));
  }
  if (status === 'lobby') await vi.waitFor(() => expect(eagle.state.status).toBe('lobby'), { timeout: 6500 });
  expect(party.room.autoDispose).toBe(true);
  const unlock = vi.spyOn(party.room, 'unlock');
  await leaveClient(party.server, eagle);
  await vi.waitFor(() => expect(matchMaker.getLocalRoomById(eagle.roomId)).toBeUndefined());
  expect(party.room.clock.delayed).toHaveLength(0);
  expect(party.room.clock.running).toBe(false);
  expect(unlock).not.toHaveBeenCalled();
  const replacement = await party.server.create();
  expect(replacement.roomId).toBe(eagle.roomId);
}, 10000);

test('client creation options cannot lower boss health', async () => {
  const server = new IntegrationServer('1');
  onTestFinished(() => server.stop());
  await server.start();
  const eagle = await server.create({ initialBossHealth: 1 });
  eagle.send('ready', { classId: 'eagle' });
  await vi.waitFor(() => expect(eagle.state.status).toBe('combat'));
  expect(eagle.state.entities.get('boss')?.health).toBe(24000);
});
