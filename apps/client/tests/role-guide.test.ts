import { expect, test } from 'vitest';
import { CLASSES } from '@mictlan/core';
import specification from '../../../SPEC.md?raw';
import { roleGuide, COMMON_CONTROLS } from '../src/role-guide';

test.each(['jaguar', 'healer', 'eagle'] as const)('%s guide preserves every section of SPEC 5.4 verbatim', (classId) => {
  const guide = roleGuide(classId);
  const section = specification.split(`**Guía del ${CLASSES[classId].name}`)[1].split('\n\n')[0].split('\n').slice(1).join('\n');
  const expected = section.trim().split('\n').map((line) => line.replace(/\*\*/g, '').replace(/^- /, '').trim());
  expect(guide.sections.map(({ title, text }) => `${title}: ${text}`)).toEqual(expected);
  expect(guide.controls).toBe(COMMON_CONTROLS);
  expect(specification).toContain(`(en todas las guías): ${guide.controls}`);
  expect(guide.name).toBe(CLASSES[classId].name);
});
