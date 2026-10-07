import { expect, test, vi } from 'vitest';
import { startRaidServer } from '../src/server.js';

vi.mock('../src/server.js', () => ({ startRaidServer: vi.fn().mockResolvedValue(undefined) }));

test('index starts the server', async () => {
  await import('../src/index.js');
  expect(startRaidServer).toHaveBeenCalledExactlyOnceWith();
});
