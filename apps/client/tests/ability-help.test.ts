import { expect, test } from 'vitest';
import { CLASSES, COMBAT_RULES, type Ability } from '@mictlan/core';
import { abilityHelp, classHelp, abilityRange } from '../src/ability-help';
import { helpSlots, guideKey } from '../src/help-layout';
import { actionSlotRects } from '../src/reading-layout';

const expectations = [
  ['jaguar', ['daño', 'control', 'defensa', 'control'], ['Sin costo', 'Sin costo', 'Sin costo', 'Sin costo']],
  ['healer', ['cura', 'cura', 'cura', 'cura'], ['40 maná', '110 maná', '50 maná', '150 maná']],
  ['eagle', ['daño', 'daño', 'control', 'movilidad'], ['Sin costo', 'Sin costo', 'Sin costo', 'Sin costo']],
] as const;

test.each(expectations)('%s presents every ability in core order with all its details', (classId, types, costs) => {
  const panel = classHelp(CLASSES[classId]);
  expect(panel.name).toBe(CLASSES[classId].name);
  expect(panel.health).toBe(`Vida: ${CLASSES[classId].maxHealth}`);
  expect(panel.abilities.map((ability) => ability.key)).toEqual(['Q', 'W', 'E', 'R']);
  panel.abilities.forEach((help, index) => {
    const ability = CLASSES[classId].abilities[index];
    expect(help).toMatchObject({ id: ability.id, name: ability.name, type: types[index], cost: costs[index] });
    expect(help.description.length).toBeGreaterThan(15);
    expect(help.cooldown).toBe(`${ability.cooldownTicks / COMBAT_RULES.ticksPerSecond} s`);
    expect(help.cast).toBe(ability.castTicks ? `${ability.castTicks / COMBAT_RULES.ticksPerSecond} s` : 'instantánea');
  });
});

test('class resources, roles and mutated numeric inputs come from definitions', () => {
  expect(classHelp(CLASSES.jaguar)).toMatchObject({ role: 'Tanque', resource: 'Sin recurso' });
  expect(classHelp(CLASSES.eagle)).toMatchObject({ role: 'Daño a distancia', resource: 'Sin recurso' });
  expect(classHelp({ ...CLASSES.healer, maxHealth: 901, maxMana: 432, manaRegenPerSecond: 7 }))
    .toMatchObject({ role: 'Sanador', health: 'Vida: 901', resource: 'Maná: 432 · Regeneración: 7/s' });
  expect(abilityHelp({ ...CLASSES.healer.abilities[0], manaCost: 13, castTicks: 50, cooldownTicks: 90, rangeMeters: 12 }, 'Z'))
    .toMatchObject({ key: 'Z', cost: '13 maná', cast: '2.5 s', cooldown: '4.5 s', range: '12 m' });
});

test('ranges distinguish self, area and displacement without treating null as infinite', () => {
  expect(abilityRange(CLASSES.jaguar.abilities[2])).toBe('Sobre ti');
  expect(abilityRange(CLASSES.jaguar.abilities[3])).toBe('Área de 8 m alrededor de ti');
  expect(abilityRange(CLASSES.healer.abilities[3])).toBe('Área de 30 m alrededor de ti');
  expect(abilityRange(CLASSES.eagle.abilities[3])).toBe('Desplazamiento de 8 m');
  expect(abilityRange({ ...CLASSES.eagle.abilities[3], effect: { ...CLASSES.eagle.abilities[3].effect, distanceMeters: 11 } }))
    .toBe('Desplazamiento de 11 m');
  expect(abilityRange({ ...CLASSES.jaguar.abilities[0], rangeMeters: null } as Ability)).toBe('Sin alcance');
});

test.each(expectations)('%s maps every tooltip to its own slot and shares HUD geometry', (classId) => {
  const slots = helpSlots(CLASSES[classId], 1280, 720);
  expect(slots.map((slot) => slot.rect)).toEqual(actionSlotRects(1280, 720));
  expect(slots.map((slot) => slot.help)).toEqual(classHelp(CLASSES[classId]).abilities);
  expect(slots.map((slot) => slot.rect.x)).toEqual([364, 504, 644, 784]);
  expect(slots[0].rect).toEqual({ x: 364, y: 650, width: 132, height: 54 });
  expect(helpSlots(CLASSES[classId], 1000, 600)[3].rect).toEqual({ x: 644, y: 530, width: 132, height: 54 });
});

test.each([
  [false, 'KeyH', false, 'open'], [true, 'KeyH', false, 'close'], [true, 'Escape', false, 'close'],
  [false, 'Escape', false, 'none'], [true, 'KeyH', true, 'none'], [false, 'KeyH', true, 'none'],
  [true, 'KeyQ', false, 'none'], [false, 'Tab', false, 'none'],
] as const)('guide keyboard %s %s repeat=%s yields %s', (open, code, repeat, expected) => {
  expect(guideKey(open, { code, repeat })).toBe(expected);
});
