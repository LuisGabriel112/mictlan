import { resolve } from 'node:path';
import { startRaidServer } from './server.js';
import { attachClientHosting } from './client-hosting.js';

export async function startProductionServer(
  environment: NodeJS.ProcessEnv = process.env,
  directory = resolve(import.meta.dirname, '..', '..', 'client', 'dist'),
) {
  // Ignore inherited development overrides when hosting friends on the public build.
  const hosted = await startRaidServer({ PORT: environment.PORT });
  attachClientHosting(hosted.httpServer, directory);
  return hosted;
}
