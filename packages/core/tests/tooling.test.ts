import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import { expect, test } from 'vitest';

const rootDirectory = resolve(import.meta.dirname, '..', '..', '..');
const require = createRequire(import.meta.url);
const eslint = new ESLint({ cwd: rootDirectory });
// ESLint cold-starts slowly under machine load; the 5 s default flakes.
const LINT_TIMEOUT_MS = 30_000;

test('resolves the three installed workspaces', () => {
  const workspaces = [
    { name: 'core', directory: join('packages', 'core'), entry: '', target: join('src', 'index.ts') },
    { name: 'server', directory: join('apps', 'server'), entry: '/package.json', target: 'package.json' },
    { name: 'client', directory: join('apps', 'client'), entry: '/package.json', target: 'package.json' },
  ];

  for (const { name, directory, entry, target } of workspaces) {
    expect(realpathSync(require.resolve(`@mictlan/${name}${entry}`))).toBe(
      realpathSync(join(rootDirectory, directory, target)),
    );
  }
});

test('rejects impure APIs in core source', async () => {
  const samples = [
    ['new Date();', 'no-restricted-globals'],
    ['setTimeout(() => {}, 0);', 'no-restricted-globals'],
    ['setInterval(() => {}, 0);', 'no-restricted-globals'],
    ["fetch('https://example.com');", 'no-restricted-globals'],
    ["window.alert('test');", 'no-restricted-globals'],
    ["document.createElement('div');", 'no-restricted-globals'],
    ['globalThis.Date.now();', 'no-restricted-globals'],
    ['Math.random();', 'no-restricted-syntax'],
    ["Math['random']();", 'no-restricted-syntax'],
  ];

  for (const [code, ruleId] of samples) {
    const [result] = await eslint.lintText(code, {
      filePath: join(rootDirectory, 'packages', 'core', 'src', 'purity-probe.ts'),
    });
    expect(result.errorCount).toBe(1);
    expect(result.messages[0].ruleId).toBe(ruleId);
  }
}, LINT_TIMEOUT_MS);

test('allows impure APIs in the simulator and apps', async () => {
  const directories = [
    join('packages', 'core', 'sim'),
    join('apps', 'server'),
    join('apps', 'client'),
  ];
  const code = `
    Date.now();
    Math.random();
    setTimeout(() => {}, 0);
    setInterval(() => {}, 0);
    fetch('https://example.com');
    window.alert('test');
    document.createElement('div');
  `;

  for (const directory of directories) {
    const [result] = await eslint.lintText(code, {
      filePath: join(rootDirectory, directory, 'purity-probe.ts'),
    });
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  }
}, LINT_TIMEOUT_MS);
