import { CLASSES, type ClassId } from '@mictlan/core';

export interface LaunchParams {
  dev: boolean;
  classId: ClassId;
  serverUrl: string;
  code: string;
}

const DEFAULT_CLASS: ClassId = 'eagle';
const SERVER_PORT = 2567;

function isClassId(value: string): value is ClassId {
  return Object.hasOwn(CLASSES, value);
}

export function parseLaunchParams(search: string, hostname = 'localhost'): LaunchParams {
  const query = new URLSearchParams(search);
  const requestedClass = query.get('class') ?? '';
  return {
    dev: query.get('dev') === '1',
    classId: isClassId(requestedClass) ? requestedClass : DEFAULT_CLASS,
    serverUrl: query.get('server') || `ws://${hostname}:${SERVER_PORT}`,
    code: (query.get('code') ?? '').toUpperCase(),
  };
}
