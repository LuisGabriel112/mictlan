import { expect, test, vi } from 'vitest';
import { startProductionServer } from '../src/production-server.js';

vi.mock('../src/production-server.js', () => ({ startProductionServer: vi.fn().mockResolvedValue(undefined) }));

test('production entrypoint starts the combined server', async () => {
  await import('../src/production-index.js');
  expect(startProductionServer).toHaveBeenCalledExactlyOnceWith();
});
