// Starts the game server and the Vite client together; Ctrl+C stops both.
import { spawn } from 'node:child_process';
import process from 'node:process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const environment = { ...process.env, MICTLAN_DEV_MIN_PLAYERS: process.env.MICTLAN_DEV_MIN_PLAYERS ?? '1' };
const workspaces = ['@mictlan/server', '@mictlan/client'];

const children = workspaces.map((workspace) =>
  spawn(npm, ['run', 'dev', '--workspace', workspace], { stdio: 'inherit', env: environment, shell: true }));

function stopAll() {
  for (const child of children) child.kill();
}

process.on('SIGINT', stopAll);
for (const child of children) child.on('exit', stopAll);
