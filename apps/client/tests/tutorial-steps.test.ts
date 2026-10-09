import { expect, test } from 'vitest';
import { advanceTutorial, isTutorialDone, startTutorial, tutorialPrompt, type TutorialProgress } from '../src/tutorial-steps';
import { entity, room } from './fixtures';
import type { EntitySnapshot, ZoneSnapshot } from '../src/snapshot';

const BOSS = entity({ id: 'boss', type: 'boss', classId: '', x: 0, y: 10 });
const ZONE: ZoneSnapshot = { id: 'z1', x: 5, y: 5, radiusMeters: 3, remainingTicks: 20 };

function step(progress: TutorialProgress, self: Partial<EntitySnapshot>, zones: ZoneSnapshot[] = []) {
  const snapshot = room([BOSS, entity({ id: 'me', classId: 'eagle', ...self })],
    { zones: Object.fromEntries(zones.map((zone) => [zone.id, zone])) });
  return advanceTutorial(progress, snapshot, 'me');
}

function atDangerStep(): TutorialProgress {
  return { stepIndex: 3, insideZone: false };
}

test('starts on step 1 asking to select the boss', () => {
  const prompt = tutorialPrompt(startTutorial(), 'eagle');
  expect(prompt).toEqual({ counter: 'Paso 1/4', text: expect.stringContaining('Selecciona al jefe') });
});

test('step 1 completes only when the boss is the target', () => {
  expect(step(startTutorial(), { targetId: '' }).stepIndex).toBe(0);
  expect(step(startTutorial(), { targetId: 'xolo' }).stepIndex).toBe(0);
  expect(step(startTutorial(), { targetId: 'boss' }).stepIndex).toBe(1);
});

test('step 2 anchors the first position and completes after walking 1 m', () => {
  const anchored = step({ stepIndex: 1, insideZone: false }, { x: 2, y: 2 });
  expect(anchored).toMatchObject({ stepIndex: 1, anchor: { x: 2, y: 2 } });
  expect(step(anchored, { x: 2.9, y: 2 }).stepIndex).toBe(1);
  expect(step(anchored, { x: 3, y: 2 }).stepIndex).toBe(2);
});

test('step 3 names the class Q ability and completes on GCD or cast', () => {
  const progress = { stepIndex: 2, insideZone: false };
  expect(tutorialPrompt(progress, 'jaguar')?.text).toContain('Zarpazo');
  expect(step(progress, {}).stepIndex).toBe(2);
  expect(step(progress, { gcdRemainingTicks: 5 }).stepIndex).toBe(3);
  const cast = { abilityId: 'a', targetId: 'boss', durationTicks: 40, remainingTicks: 40, interruptible: true };
  expect(step(progress, { cast }).stepIndex).toBe(3);
});

test('step 4 completes when leaving a zone alive', () => {
  const inside = step(atDangerStep(), { x: 5, y: 5 }, [ZONE]);
  expect(inside).toMatchObject({ stepIndex: 3, insideZone: true });
  expect(step(atDangerStep(), { x: 9, y: 9 }, [ZONE]).stepIndex).toBe(3);
  const left = step(inside, { x: 9, y: 9 }, [ZONE]);
  expect(isTutorialDone(left)).toBe(true);
  expect(tutorialPrompt(left, 'eagle')).toBeUndefined();
});

test('dying inside a zone resets step 4', () => {
  const inside = step(atDangerStep(), { x: 5, y: 5 }, [ZONE]);
  const dead = step(inside, { x: 5, y: 5, health: 0 }, [ZONE]);
  expect(dead).toMatchObject({ stepIndex: 3, insideZone: false });
  expect(step(dead, { x: 9, y: 9, health: 0 }, [ZONE]).stepIndex).toBe(3);
});

test('missing self entity keeps progress unchanged', () => {
  const progress = startTutorial();
  expect(advanceTutorial(progress, room([BOSS]), 'me')).toBe(progress);
});
