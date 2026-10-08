import { join, resolve } from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { startRaidServer } from '../src/server.js';
import { attachClientHosting } from '../src/client-hosting.js';
import { startProductionServer } from '../src/production-server.js';

vi.mock('../src/server.js', () => ({ startRaidServer: vi.fn(async () => ({
  httpServer: {}, gameServer: { listen: vi.fn().mockResolvedValue(undefined) },
})) }));
vi.mock('../src/client-hosting.js', () => ({ attachClientHosting: vi.fn() }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

test.each([{}, { PORT: '3456', MICTLAN_DEV_MIN_PLAYERS: '1' }])('startProductionServer forwards only PORT', async (environment) => {
  const hosted = await startProductionServer(environment, 'fake-dist');
  expect(startRaidServer).toHaveBeenCalledExactlyOnceWith({ PORT: environment.PORT });
  expect(attachClientHosting).toHaveBeenCalledExactlyOnceWith(hosted.httpServer, 'fake-dist');
  expect(vi.mocked(startRaidServer).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(attachClientHosting).mock.invocationCallOrder[0]);
});

test('startProductionServer defaults to environment and a dist path independent of cwd', async () => {
  vi.stubEnv('PORT', '4321');
  const hosted = await startProductionServer();
  expect(startRaidServer).toHaveBeenCalledWith({ PORT: '4321' });
  expect(attachClientHosting).toHaveBeenCalledWith(hosted.httpServer, resolve(import.meta.dirname, '..', '..', 'client', 'dist'));
});

test('startProductionServer propagates startup failure without attaching static hosting', async () => {
  vi.mocked(startRaidServer).mockRejectedValueOnce(new Error('port busy'));
  await expect(startProductionServer({}, 'dist')).rejects.toThrow('port busy');
  expect(attachClientHosting).not.toHaveBeenCalled();
});

test('package scripts build first, run one Node server and expose Vite on LAN', async () => {
  const { readFile } = await import('node:fs/promises');
  const repository = resolve(import.meta.dirname, '..', '..', '..');
  const rootPackage = JSON.parse(await readFile(join(repository, 'package.json'), 'utf8'));
  const clientPackage = JSON.parse(await readFile(join(repository, 'apps', 'client', 'package.json'), 'utf8'));
  const serverPackage = JSON.parse(await readFile(join(repository, 'apps', 'server', 'package.json'), 'utf8'));
  expect(rootPackage.scripts.start).toBe('npm run build --workspace @mictlan/client && npm run start --workspace @mictlan/server');
  expect(serverPackage.scripts.start).toBe('node --import tsx src/production-index.ts');
  expect(clientPackage.scripts.dev).toBe('vite --host');
});
