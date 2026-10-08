import { describe, expect, test } from 'vitest';
import {
  CAST_BORDER, GROUP_FRAME_LAYOUT, bossCastBar, castBarBorder, groupFrameAt, groupFrameRect, groupFrames,
  selfFrame, targetFrame,
} from '../src/frames';
import { ENTITY_COLORS } from '../src/palette';
import { entity, room } from './fixtures';

const lament = { abilityId: 'lamentOfTheDead', targetId: '', durationTicks: 60, remainingTicks: 20, interruptible: true };
const strike = { abilityId: 'flayedStrike', targetId: 'p1', durationTicks: 50, remainingTicks: 50, interruptible: false };
const arrow = { abilityId: 'obsidianArrow', targetId: 'boss', durationTicks: 40, remainingTicks: 10, interruptible: false };

describe('selfFrame', () => {
  test('shows class name, health and mana for casters', () => {
    const frame = selfFrame(room([entity({ id: 'p1', classId: 'healer', health: 600, maxHealth: 700, mana: 812.6, maxMana: 1000 })]), 'p1');
    expect(frame).toMatchObject({
      id: 'p1', name: 'Tícitl (tú)', isSelf: true, dead: false, color: ENTITY_COLORS.healer,
      health: { value: 600, max: 700, ratio: 600 / 700 }, resource: { value: 812, max: 1000, ratio: 0.812 },
    });
  });

  test('a class without mana has no resource bar', () => {
    expect(selfFrame(room([entity({ id: 'p1', classId: 'jaguar' })]), 'p1')?.resource).toBeUndefined();
  });

  test('overkill shows zero health and marks the unit dead', () => {
    const frame = selfFrame(room([entity({ id: 'p1', health: -20, maxHealth: 750 })]), 'p1');
    expect(frame).toMatchObject({ dead: true, health: { value: 0, max: 750, ratio: 0 } });
  });

  test('exactly zero health also counts as dead', () => {
    expect(selfFrame(room([entity({ id: 'p1', health: 0 })]), 'p1')?.dead).toBe(true);
  });

  test('a missing self has no frame', () => {
    expect(selfFrame(room([]), 'p1')).toBeUndefined();
  });
});

describe('targetFrame', () => {
  const boss = entity({ id: 'boss', type: 'boss', classId: '', health: 12000, maxHealth: 24000, cast: lament });

  test('mirrors the selected unit and its interruptible cast', () => {
    const frame = targetFrame(room([entity({ id: 'p1', targetId: 'boss' }), boss]), 'p1');
    expect(frame).toMatchObject({ id: 'boss', name: 'Mictlantecuhtli', isSelf: false,
      health: { value: 12000, max: 24000, ratio: 0.5 } });
    expect(frame?.cast).toEqual({ abilityName: 'Lamento de los muertos', progress: 40 / 60, remainingSeconds: 1, interruptible: true });
  });

  test('without a target or with an unknown one there is no frame', () => {
    expect(targetFrame(room([entity({ id: 'p1' })]), 'p1')).toBeUndefined();
    expect(targetFrame(room([entity({ id: 'p1', targetId: 'gone' })]), 'p1')).toBeUndefined();
  });
});

describe('cast bars', () => {
  test('own and boss casts are reported separately', () => {
    const snapshot = room([
      entity({ id: 'p1', cast: arrow }), entity({ id: 'boss', type: 'boss', classId: '', cast: strike }),
    ]);
    expect(selfFrame(snapshot, 'p1')?.cast).toEqual({ abilityName: 'Flecha de obsidiana', progress: 0.75,
      remainingSeconds: 0.5, interruptible: false });
    expect(bossCastBar(snapshot)).toEqual({ abilityName: 'Golpe del Descarnado', progress: 0, remainingSeconds: 2.5,
      interruptible: false });
  });

  test('without casts the bars are hidden', () => {
    const snapshot = room([entity({ id: 'p1' }), entity({ id: 'boss', type: 'boss', classId: '' })]);
    expect(selfFrame(snapshot, 'p1')?.cast).toBeUndefined();
    expect(bossCastBar(snapshot)).toBeUndefined();
    expect(bossCastBar(room([]))).toBeUndefined();
  });

  test('unknown ability ids fall back to the raw id', () => {
    const odd = { ...arrow, abilityId: 'mystery' };
    expect(selfFrame(room([entity({ id: 'p1', cast: odd })]), 'p1')?.cast?.abilityName).toBe('mystery');
  });

  test.each([[true, CAST_BORDER.interruptible], [false, CAST_BORDER.uninterruptible]])(
    'interruptible %s uses border %s', (interruptible, color) => {
      expect(castBarBorder({ interruptible })).toBe(color);
    },
  );

  test('interruptible casts are turquoise and the rest gray', () => {
    expect(CAST_BORDER).toEqual({ interruptible: 0x2ec4b6, uninterruptible: 0x888888 });
  });
});

describe('group frames', () => {
  const snapshot = room([
    entity({ id: 'p2', classId: 'jaguar' }), entity({ id: 'p3' }), entity({ id: 'p1', classId: 'healer' }),
    entity({ id: 'boss', type: 'boss', classId: '' }),
  ]);

  test('list players with self first and then by id', () => {
    expect(groupFrames(snapshot, 'p3').map(({ id }) => id)).toEqual(['p3', 'p1', 'p2']);
  });

  test('rects stack vertically from the layout origin', () => {
    const { left, top, width, height, gap } = GROUP_FRAME_LAYOUT;
    expect(groupFrameRect(0)).toEqual({ x: left, y: top, width, height });
    expect(groupFrameRect(2)).toEqual({ x: left, y: top + 2 * (height + gap), width, height });
  });

  test('a click inside a frame selects its unit and outside selects nothing', () => {
    const second = groupFrameRect(1);
    expect(groupFrameAt(snapshot, 'p3', { x: second.x + 5, y: second.y + 5 })).toBe('p1');
    expect(groupFrameAt(snapshot, 'p3', { x: second.x + second.width + 1, y: second.y + 5 })).toBeUndefined();
    const below = groupFrameRect(3);
    expect(groupFrameAt(snapshot, 'p3', { x: below.x + 5, y: below.y + 5 })).toBeUndefined();
  });
});
