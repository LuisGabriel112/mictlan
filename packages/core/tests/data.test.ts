import { describe, expect, test } from 'vitest';
import {
  BOSS,
  BOSS_ABILITIES,
  BOSS_PHASES,
  CLASSES,
  COMBAT_RULES,
  PARTY_RULES,
  XOLO,
} from '../src/index.js';

describe('T1.1 acceptance values from SPEC', () => {
  test('class health matches SPEC §5', () => {
    expect(CLASSES.jaguar.maxHealth).toBe(1200);
    expect(CLASSES.healer.maxHealth).toBe(700);
    expect(CLASSES.eagle.maxHealth).toBe(750);
  });

  test('Great Remedy costs 110 mana', () => {
    expect(CLASSES.healer.abilities[1]).toMatchObject({
      id: 'greatRemedy', manaCost: 110, castTicks: 60,
    });
  });

  test('Obsidian Shield cooldown is 360 ticks', () => {
    expect(CLASSES.jaguar.abilities[2]).toMatchObject({
      id: 'obsidianShield', cooldownTicks: 360,
    });
  });

  test('mana regeneration remains 18 per second', () => {
    expect(CLASSES.healer.manaRegenPerSecond).toBe(18);
    expect(CLASSES.healer.maxMana).toBe(1000);
  });

  test('boss health is 24000, 40000 and 56000 for 3, 4 and 5 players', () => {
    expect(BOSS.maxHealthByPlayerCount).toEqual({ 3: 24000, 4: 40000, 5: 56000 });
  });

  test('xolo health is 300 for 3 players and 600 for 5 players', () => {
    expect(XOLO.maxHealthByPlayerCount).toEqual({ 3: 300, 4: 450, 5: 600 });
  });

  test('phase 3 schedules only Strike at 200/400 and Lament at 160/360 ticks', () => {
    expect(BOSS_PHASES[3].timers).toEqual({
      flayedStrike: { firstTicks: 200, intervalTicks: 400 },
      lamentOfTheDead: { firstTicks: 160, intervalTicks: 360 },
    });
    expect(BOSS_PHASES[3].timers).not.toHaveProperty('obsidianWind');
    expect(BOSS_PHASES[3].timers).not.toHaveProperty('callOfTheXolos');
  });
});

describe('complete SPEC §3, §5 and §6 data', () => {
  test('global units, combat constants and party composition match SPEC', () => {
    expect(COMBAT_RULES).toEqual({
      tickDurationMs: 50,
      ticksPerSecond: 20,
      basisPointsScale: 10000,
      gcdTicks: 20,
      defaultCritChance: 0.10,
      criticalMultiplierBps: 15000,
      minimumDamage: 1,
      playerSpeedMetersPerSecond: 7,
      enemySpeedMetersPerSecond: 5,
      playerBodyRadiusMeters: 0.5,
      meleeRangeMeters: 4,
      rangedRangeMeters: 30,
      arena: {
        center: { x: 0, y: 0 },
        wallRadiusMeters: 20,
        initialSafeRadiusMeters: 20,
      },
    });
    expect(PARTY_RULES).toEqual({
      devMinPlayers: 1,
      minPlayers: 3,
      maxPlayers: 5,
      composition: {
        jaguar: { min: 1, max: 1 },
        healer: { min: 1, max: 1 },
        eagle: { min: 1, max: 3 },
      },
    });
  });

  test('class stats use basis points and only Jaguar has an auto-attack', () => {
    expect(CLASSES.jaguar).toMatchObject({
      id: 'jaguar', name: 'Guerrero Jaguar', role: 'tank',
      armorBps: 3000, threatMultiplierBps: 30000, maxMana: 0, manaRegenPerSecond: 0,
      autoAttack: { abilityId: 'autoAttack', baseDamage: 20, intervalTicks: 40, rangeMeters: 4 },
    });
    expect(CLASSES.healer).toMatchObject({
      id: 'healer', name: 'Tícitl', role: 'healer',
      armorBps: 0, threatMultiplierBps: 10000, autoAttack: null,
    });
    expect(CLASSES.eagle).toMatchObject({
      id: 'eagle', name: 'Guerrero Águila', role: 'damage',
      armorBps: 0, threatMultiplierBps: 10000, maxMana: 0, manaRegenPerSecond: 0,
      autoAttack: null,
    });
  });

  test('the twelve abilities retain their slot, cost, cooldown, cast, GCD and range', () => {
    const rows = Object.values(CLASSES).map(({ id, abilities }) => ({
      id,
      abilities: abilities.map((ability) => [
        ability.id, ability.name, ability.targetType, ability.manaCost,
        ability.cooldownTicks, ability.castTicks, ability.triggersGcd, ability.rangeMeters,
      ]),
    }));
    expect(rows).toEqual([
      {
        id: 'jaguar',
        abilities: [
          ['claw', 'Zarpazo', 'enemy', 0, 60, 0, true, 4],
          ['taunt', 'Provocar', 'enemy', 0, 160, 0, false, 30],
          ['obsidianShield', 'Escudo de obsidiana', 'self', 0, 360, 0, false, null],
          ['roar', 'Rugido', 'none', 0, 160, 0, true, 8],
        ],
      },
      {
        id: 'healer',
        abilities: [
          ['remedy', 'Remedio', 'ally', 40, 0, 30, true, 30],
          ['greatRemedy', 'Gran remedio', 'ally', 110, 0, 60, true, 30],
          ['copal', 'Copal', 'ally', 50, 0, 0, true, 30],
          ['offering', 'Ofrenda', 'none', 150, 900, 0, true, 30],
        ],
      },
      {
        id: 'eagle',
        abilities: [
          ['obsidianArrow', 'Flecha de obsidiana', 'enemy', 0, 0, 40, true, 30],
          ['quickShot', 'Disparo veloz', 'enemy', 0, 120, 0, true, 30],
          ['warCry', 'Grito de guerra', 'enemy', 0, 300, 0, false, 30],
          ['flight', 'Vuelo', 'none', 0, 240, 0, false, null],
        ],
      },
    ]);
  });

  test('Jaguar effects include flat threat, taunt and the shield multiplier', () => {
    expect(CLASSES.jaguar.abilities.map(({ effect }) => effect)).toEqual([
      { type: 'damage', baseDamage: 40 },
      { type: 'taunt', durationTicks: 60, threatMultiplierBps: 11000 },
      {
        type: 'applyAura',
        aura: {
          id: 'obsidianShield', name: 'Escudo de obsidiana',
          type: 'damageTakenMultiplier', durationTicks: 120, multiplierBps: 5000,
        },
      },
      { type: 'areaDamage', baseDamage: 25, flatThreat: 50 },
    ]);
  });

  test('healer effects include Copal timing and non-stacking refresh', () => {
    expect(CLASSES.healer.abilities.map(({ effect }) => effect)).toEqual([
      { type: 'heal', baseHealing: 120 },
      { type: 'heal', baseHealing: 350 },
      {
        type: 'applyAura',
        aura: {
          id: 'copal', name: 'Copal', type: 'periodicHealing', durationTicks: 200,
          baseHealing: 20, intervalTicks: 20, firstTickDelayTicks: 20,
          refreshBehavior: 'resetDurationAndInterval', stacks: false,
        },
      },
      { type: 'areaHeal', baseHealing: 150, includesSelf: true },
    ]);
  });

  test('Eagle effects include interrupt requirements and Flight displacement', () => {
    expect(CLASSES.eagle.abilities.map(({ effect }) => effect)).toEqual([
      { type: 'damage', baseDamage: 140 },
      { type: 'damage', baseDamage: 70 },
      { type: 'interrupt', requiresInterruptibleCast: true },
      {
        type: 'dash', distanceMeters: 8, direction: 'movementOrFacing',
        boundary: 'arenaWall', cancelsOwnCast: true,
      },
    ]);
  });

  test('phase 1 and 2 timers and phase thresholds match SPEC §6', () => {
    expect(BOSS_PHASES[1]).toEqual({
      name: 'Los nueve ríos', healthThresholdBps: 10000,
      timers: {
        flayedStrike: { firstTicks: 200, intervalTicks: 400 },
        obsidianWind: { firstTicks: 120, intervalTicks: 300 },
        lamentOfTheDead: { firstTicks: 280, intervalTicks: 500 },
      },
    });
    expect(BOSS_PHASES[2]).toEqual({
      name: 'Los guías', healthThresholdBps: 6500,
      timers: {
        flayedStrike: { firstTicks: 200, intervalTicks: 400 },
        obsidianWind: { firstTicks: 120, intervalTicks: 240 },
        lamentOfTheDead: { firstTicks: 280, intervalTicks: 500 },
        callOfTheXolos: { firstTicks: 0, intervalTicks: 800 },
      },
    });
    expect(BOSS_PHASES[3]).toMatchObject({ name: 'Río Apanohuaya', healthThresholdBps: 3000 });
  });

  test('boss abilities preserve damage, cast times, warnings and summon count', () => {
    expect(BOSS_ABILITIES).toEqual({
      flayedStrike: {
        id: 'flayedStrike', name: 'Golpe del Descarnado', castTicks: 50,
        interruptible: false, canUseWhileCasting: false,
        effect: { type: 'damage', baseDamage: 400 },
      },
      obsidianWind: {
        id: 'obsidianWind', name: 'Viento de obsidiana', castTicks: 0,
        interruptible: false, canUseWhileCasting: true,
        effect: {
          type: 'wind', baseDamage: 200, radiusMeters: 4, maxTargets: 3, warningTicks: 40,
          placement: 'fixedTargetPosition', overlappingDamage: 'stack',
        },
      },
      lamentOfTheDead: {
        id: 'lamentOfTheDead', name: 'Lamento de los muertos', castTicks: 60,
        interruptible: true, canUseWhileCasting: false,
        effect: { type: 'raidDamage', baseDamage: 250 },
      },
      callOfTheXolos: {
        id: 'callOfTheXolos', name: 'Llamado de los xolos', castTicks: 0,
        interruptible: false, canUseWhileCasting: true,
        effect: { type: 'summon', entityType: 'xolo', count: 2, placement: 'oppositeArenaEdges' },
      },
    });
  });

  test('boss stats, spawn, enrage and final arena use SPEC units', () => {
    expect(BOSS).toMatchObject({
      id: 'boss', name: 'Mictlantecuhtli, Señor del Mictlán',
      armorBps: 0, bodyRadiusMeters: 1.5, speedMetersPerSecond: 5,
      autoAttack: { abilityId: 'autoAttack', baseDamage: 60, intervalTicks: 40, rangeMeters: 4 },
      spawn: { x: 0, y: 0 }, pullDistanceMeters: 10,
      playerSpawn: { centerX: 0, y: -15, spacingMeters: 2 },
      enrage: {
        afterTicks: 9600, damageMultiplierBps: 50000,
        affectedAbilityIds: ['autoAttack', 'flayedStrike', 'lamentOfTheDead', 'obsidianWind'],
      },
      finalPhaseArena: {
        safeRadiusMeters: 12, shrinkDurationTicks: 200, damagePerTick: 5,
        ignoresArmor: true, ignoresAuras: true, canCrit: false,
      },
      returnToLobbyDelayTicks: 100,
    });
  });

  test('xolo stats include 25 damage every 30 ticks and a 0.5 meter body', () => {
    expect(XOLO).toMatchObject({
      id: 'xolo', name: 'Xolo espectral', armorBps: 0,
      bodyRadiusMeters: 0.5, speedMetersPerSecond: 5,
      autoAttack: { abilityId: 'autoAttack', baseDamage: 25, intervalTicks: 30, rangeMeters: 4 },
      initialThreat: 1, preferredTargetClassId: 'healer', fallbackTarget: 'nearestLivingPlayer',
    });
  });
});
