import { expect, onTestFinished, vi } from 'vitest';
import { BOSS, COMBAT_RULES, type ClassId, type CombatEvent } from '@mictlan/core';
import type { RaidServerOptions } from '../src/server.js';
import type { LobbyState } from '../src/schema/LobbyState.js';
import { IntegrationServer } from './integration-fixture.js';

export async function leaveClient(server: IntegrationServer, client: IntegrationServer['clients'][number]): Promise<void> {
  await client.leave();
  server.clients.splice(server.clients.indexOf(client), 1);
}

export async function connectedEndingParty(classes: ClassId[], options: RaidServerOptions = {}, minimum = '1') {
  const server = new IntegrationServer(minimum, { critChance: 0, ...options });
  onTestFinished(() => server.stop());
  await server.start();
  const leader = await server.create();
  for (let index = 1; index < classes.length; index += 1) await server.join(leader.roomId);
  const clients = [...server.clients];
  const batches = clients.map(() => [] as CombatEvent[]);
  clients.forEach((client, index) => client.onMessage<CombatEvent[]>('events', (events) => batches[index].push(...events)));
  clients.forEach((client, index) => client.send('ready', { classId: classes[index] }));
  await vi.waitFor(() => expect(clients.every((client) => client.state.status === 'combat')).toBe(true));
  return { server, clients, batches, room: server.room(leader.roomId) };
}

export function expectCleanLobby(state: LobbyState, classes: ClassId[]): void {
  expect(state).toMatchObject({ status: 'lobby', tick: 0, elapsedTicks: 0, phase: 0, safeRadiusMeters: 0 });
  expect(state.entities.size).toBe(0);
  expect(state.zones.size).toBe(0);
  expect([...state.players.values()].map(({ classId }) => classId).sort()).toEqual([...classes].sort());
  expect([...state.players.values()].every(({ ready }) => !ready)).toBe(true);
}

export async function expectTimedReturn(party: Awaited<ReturnType<typeof connectedEndingParty>>, outcome: 'victory' | 'defeat') {
  const { clients, room } = party;
  await vi.waitFor(() => expect(clients.every((client) => client.state.status === outcome)).toBe(true));
  const terminal = room.encounter;
  const remainingDelay = BOSS.returnToLobbyDelayTicks * COMBAT_RULES.tickDurationMs;
  expect(room.locked).toBe(true);
  await new Promise((resolve) => room.clock.setTimeout(resolve, remainingDelay - 500));
  expect(room.state.status).toBe(outcome);
  expect(room.encounter).toBe(terminal);
  await vi.waitFor(() => expect(clients.every((client) => client.state.status === 'lobby')).toBe(true), { timeout: 1500 });
  expect(room.encounter).toBeUndefined();
  expect(room.locked).toBe(false);
}
