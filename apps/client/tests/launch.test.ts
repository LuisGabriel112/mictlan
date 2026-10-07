import { describe, expect, test, vi } from 'vitest';
import { connectToRaid, type RaidClient } from '../src/connection';
import { parseLaunchParams } from '../src/launch-params';

describe('parseLaunchParams', () => {
  test.each([
    ['', { dev: false, classId: 'eagle', serverUrl: 'ws://localhost:2567', code: '' }],
    ['?dev=1', { dev: true, classId: 'eagle', serverUrl: 'ws://localhost:2567', code: '' }],
    ['?dev=1&class=jaguar', { dev: true, classId: 'jaguar', serverUrl: 'ws://localhost:2567', code: '' }],
    ['?dev=1&class=wizard', { dev: true, classId: 'eagle', serverUrl: 'ws://localhost:2567', code: '' }],
    ['?server=ws://10.0.0.5:2567&code=abcd', { dev: false, classId: 'eagle', serverUrl: 'ws://10.0.0.5:2567', code: 'ABCD' }],
    ['?dev=0', { dev: false, classId: 'eagle', serverUrl: 'ws://localhost:2567', code: '' }],
  ])('%s', (search, expected) => {
    expect(parseLaunchParams(search)).toEqual(expected);
  });
});

function fakeClient() {
  const room = { send: vi.fn() };
  const client = {
    joinOrCreate: vi.fn(async () => room), create: vi.fn(async () => room), joinById: vi.fn(async () => room),
  } satisfies RaidClient;
  return { client, room };
}

describe('connectToRaid', () => {
  test('dev mode joins or creates a raid and readies with its class', async () => {
    const { client, room } = fakeClient();
    await expect(connectToRaid({ dev: true, classId: 'healer', serverUrl: '', code: '' }, client)).resolves.toBe(room);
    expect(client.joinOrCreate).toHaveBeenCalledWith('raid');
    expect(room.send).toHaveBeenCalledWith('ready', { classId: 'healer' });
  });

  test('a room code joins that room without readying', async () => {
    const { client, room } = fakeClient();
    await connectToRaid({ dev: false, classId: 'eagle', serverUrl: '', code: 'ABCD' }, client);
    expect(client.joinById).toHaveBeenCalledWith('ABCD');
    expect(room.send).not.toHaveBeenCalled();
  });

  test('without dev mode or code it creates a new raid', async () => {
    const { client } = fakeClient();
    await connectToRaid({ dev: false, classId: 'eagle', serverUrl: '', code: '' }, client);
    expect(client.create).toHaveBeenCalledWith('raid');
    expect(client.joinOrCreate).not.toHaveBeenCalled();
  });
});
