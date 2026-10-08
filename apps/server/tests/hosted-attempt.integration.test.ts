import { expect, test, vi } from 'vitest';
import type { ClassId } from '@mictlan/core';
import { attachClientHosting } from '../src/client-hosting.js';
import { connectedEndingParty, expectCleanLobby, expectTimedReturn } from './ending-integration-fixture.js';

test('C1 automatic support: three roles finish and rejoin while client hosting is attached', async () => {
  const classes: ClassId[] = ['eagle', 'healer', 'jaguar'];
  const party = await connectedEndingParty(classes, { initialBossHealth: 1 }, '3');
  attachClientHosting(party.server.hosted.httpServer, 'unused', vi.fn());
  const [eagle] = party.clients;
  eagle.send('target', { entityId: 'boss' });
  eagle.send('cast', { abilityId: 'quickShot' });
  await expectTimedReturn(party, 'victory');
  party.clients.forEach((client) => expectCleanLobby(client.state, classes));
  const joined = await party.server.join(eagle.roomId);
  expect(joined.state.status).toBe('lobby');
  expect(party.room.encounter).toBeUndefined();
}, 10000);
