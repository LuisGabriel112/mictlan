import { join, resolve } from 'node:path';
import { expect, test, vi } from 'vitest';
import { clientAssetPath, clientContentType } from '../src/client-assets.js';
import { endClientResponse, sendClientAsset, loadClientAsset, resolveClientAsset, serveClient } from '../src/static-client.js';

const root = resolve('fixture-dist');

test.each([
  ['/', 'index.html'], ['/assets/app.js?v=1', join('assets', 'app.js')], ['/sala/ABCD', join('sala', 'ABCD')],
  ['/hello%20world.svg', 'hello world.svg'],
])('clientAssetPath resolves %s inside dist', (url, expected) => {
  expect(clientAssetPath(url, root)).toBe(join(root, expected));
});

test.each(['/../secret', '/%2e%2e/secret', '/assets/../../secret', '/x%5csecret', '/C:/secret', '/%00', '/%ZZ', '/.env'])(
  'clientAssetPath rejects unsafe path %s', (url) => { expect(clientAssetPath(url, root)).toBeNull(); });

test.each([
  ['app.js', 'text/javascript; charset=utf-8'], ['app.css', 'text/css; charset=utf-8'],
  ['index.html', 'text/html; charset=utf-8'], ['icon.svg', 'image/svg+xml'],
  ['image.png', 'image/png'], ['font.woff2', 'font/woff2'], ['unknown.bin', 'application/octet-stream'],
])('clientContentType selects %s', (file, mime) => { expect(clientContentType(file)).toBe(mime); });

test('loadClientAsset reads through the injected filesystem', async () => {
  const contents = Buffer.from('asset');
  const read = vi.fn().mockResolvedValue(contents);
  expect(await loadClientAsset('asset.js', read)).toBe(contents);
  expect(read).toHaveBeenCalledExactlyOnceWith('asset.js');
});

test.each(['ENOENT', 'EISDIR'])('loadClientAsset treats %s as absent', async (code) => {
  expect(await loadClientAsset('missing', vi.fn().mockRejectedValue({ code }))).toBeNull();
});

test.each([new Error('failed'), { code: 'EACCES' }, null])('loadClientAsset propagates other errors', async (error) => {
  await expect(loadClientAsset('asset', vi.fn().mockRejectedValue(error))).rejects.toBe(error);
});

test('resolveClientAsset serves an existing extensionless file without falling back', async () => {
  const read = vi.fn().mockResolvedValue(Buffer.from('plain'));
  expect(await resolveClientAsset('/LICENSE', root, read)).toEqual({ body: Buffer.from('plain'), type: 'application/octet-stream' });
  expect(read).toHaveBeenCalledTimes(1);
});

test('resolveClientAsset falls back only for missing extensionless routes', async () => {
  const read = vi.fn().mockRejectedValueOnce({ code: 'ENOENT' }).mockResolvedValue(Buffer.from('index'));
  expect(await resolveClientAsset('/sala/ABCD?code=ABCD', root, read)).toEqual({ body: Buffer.from('index'), type: 'text/html; charset=utf-8' });
  expect(read.mock.calls).toEqual([[join(root, 'sala', 'ABCD')], [join(root, 'index.html')]]);
});

test.each(['/missing.js', '/route', '/%ZZ'])('resolveClientAsset returns null for unavailable %s', async (url) => {
  expect(await resolveClientAsset(url, root, vi.fn().mockRejectedValue({ code: 'ENOENT' }))).toBeNull();
});

function responseMock() {
  return { writeHead: vi.fn(), end: vi.fn() };
}

test('endClientResponse sends an empty status response', () => {
  const response = responseMock();
  endClientResponse(response, 405);
  expect(response.writeHead).toHaveBeenCalledExactlyOnceWith(405);
  expect(response.end).toHaveBeenCalledExactlyOnceWith();
});

test.each(['GET', 'HEAD'])('sendClientAsset writes %s with byte length and MIME type', (method) => {
  const response = responseMock();
  sendClientAsset({ body: Buffer.from('asset'), type: 'text/javascript' }, method, response);
  expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/javascript', 'Content-Length': 5 });
  expect(response.end).toHaveBeenCalledWith(method === 'HEAD' ? undefined : Buffer.from('asset'));
});

test('sendClientAsset returns 404 when the asset is absent', () => {
  const response = responseMock();
  sendClientAsset(null, 'GET', response);
  expect(response.writeHead).toHaveBeenCalledWith(404);
  expect(response.end).toHaveBeenCalledWith();
});

test.each(['GET', 'HEAD'])('serveClient handles %s with the correct body and headers', async (method) => {
  const response = responseMock();
  await serveClient({ method, url: '/' }, response, root, vi.fn().mockResolvedValue(Buffer.from('index')));
  expect(response.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': 5 });
  expect(response.end).toHaveBeenCalledWith(method === 'HEAD' ? undefined : Buffer.from('index'));
});

test('serveClient defaults missing method and URL to GET /', async () => {
  const response = responseMock();
  await serveClient({}, response, root, vi.fn().mockResolvedValue(Buffer.from('index')));
  expect(response.end).toHaveBeenCalledWith(Buffer.from('index'));
});

test.each([
  ['POST', '/', 405, undefined], ['GET', '/missing.js', 404, { code: 'ENOENT' }],
  ['GET', '/%00', 404, undefined], ['GET', '/', 500, { code: 'EACCES' }],
])('serveClient returns %s %s => %s', async (method, url, status, error) => {
  const response = responseMock();
  await serveClient({ method, url }, response, root, vi.fn().mockRejectedValue(error));
  expect(response.writeHead).toHaveBeenCalledWith(status);
  expect(response.end).toHaveBeenCalledWith();
});
