import { extname, join } from 'node:path';

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

export function clientAssetPath(url: string, directory: string): string | null {
  try {
    const pathname = decodeURIComponent(url.split('?')[0]);
    const segments = pathname.split('/');
    if (/[\\:\0]/.test(pathname) || segments.some((segment) => segment.startsWith('.'))) return null;
    return join(directory, pathname === '/' ? 'index.html' : pathname);
  } catch {
    return null;
  }
}

export function clientContentType(filePath: string): string {
  return CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream';
}
