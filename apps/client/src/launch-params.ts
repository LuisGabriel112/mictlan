import { CLASSES, type ClassId } from '@mictlan/core';

export interface LaunchParams {
  dev: boolean;
  classId: ClassId;
  serverUrl: string;
  code: string;
}

const DEFAULT_CLASS: ClassId = 'eagle';
const SERVER_PORT = 2567;
interface PageLocation { protocol: string; host: string; hostname: string }
const LOCAL_PAGE: PageLocation = { protocol: 'http:', host: 'localhost', hostname: 'localhost' };

export function parseClassId(value: string | null): ClassId {
  return value !== null && Object.hasOwn(CLASSES, value) ? value as ClassId : DEFAULT_CLASS;
}

export function serverUrlForPage(page: PageLocation, production: boolean): string {
  if (!production) return `ws://${page.hostname}:${SERVER_PORT}`;
  const protocol = page.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${page.host}`;
}

export function parseLaunchParams(search: string, page = LOCAL_PAGE, production = false): LaunchParams {
  const query = new URLSearchParams(search);
  return {
    dev: query.get('dev') === '1',
    classId: parseClassId(query.get('class')),
    serverUrl: query.get('server') || serverUrlForPage(page, production),
    code: (query.get('code') ?? '').toUpperCase(),
  };
}
