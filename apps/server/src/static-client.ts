import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { clientAssetPath, clientContentType } from './client-assets.js';

type ReadAsset = (filePath: string) => Promise<Buffer>;
interface ClientRequest { method?: string; url?: string }
interface ClientResponse {
  writeHead(status: number, headers?: Record<string, string | number>): unknown;
  end(body?: Buffer): unknown;
}
interface ClientAsset { body: Buffer; type: string }

export async function loadClientAsset(filePath: string, read: ReadAsset): Promise<Buffer | null> {
  try {
    return await read(filePath);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error
      && ['ENOENT', 'EISDIR'].includes(String(error.code))) return null;
    throw error;
  }
}

export async function resolveClientAsset(url: string, directory: string, read: ReadAsset) {
  let filePath = clientAssetPath(url, directory);
  if (filePath === null) return null;
  let body = await loadClientAsset(filePath, read);
  if (body === null && extname(filePath) === '') {
    filePath = join(directory, 'index.html');
    body = await loadClientAsset(filePath, read);
  }
  return body === null ? null : { body, type: clientContentType(filePath) };
}

export async function serveClient(
  request: ClientRequest, response: ClientResponse, directory: string, read: ReadAsset = readFile,
): Promise<void> {
  if (!['GET', 'HEAD'].includes(request.method ?? 'GET')) {
    endClientResponse(response, 405);
    return;
  }
  try {
    const asset = await resolveClientAsset(request.url ?? '/', directory, read);
    sendClientAsset(asset, request.method, response);
  } catch {
    endClientResponse(response, 500);
  }
}

export function endClientResponse(response: ClientResponse, status: number): void {
  response.writeHead(status);
  response.end();
}

export function sendClientAsset(asset: ClientAsset | null, method: string | undefined, response: ClientResponse): void {
  if (asset === null) { endClientResponse(response, 404); return; }
  response.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': asset.body.length });
  response.end(method === 'HEAD' ? undefined : asset.body);
}
