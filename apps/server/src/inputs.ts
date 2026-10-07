import { CLASSES, type Input, type PlayerAbilityId } from '@mictlan/core';

export const INPUT_RULES = {
  // Core keeps only the last move and first cast per tick, so 16 covers any honest client.
  maxInputsPerPlayerPerTick: 16,
} as const;

type InputParser = (playerId: string, payload: Record<string, unknown>) => Input | undefined;

const CAST_TIME_ABILITY_IDS: ReadonlySet<string> = new Set(
  Object.values(CLASSES).flatMap((definition) => definition.abilities.filter(({ castTicks }) => castTicks > 0).map(({ id }) => id)),
);

const PLAYER_ABILITY_IDS: ReadonlySet<string> = new Set(
  Object.values(CLASSES).flatMap((definition) => definition.abilities.map(({ id }) => id)),
);

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

function isPlayerAbilityId(abilityId: unknown): abilityId is PlayerAbilityId {
  return typeof abilityId === 'string' && PLAYER_ABILITY_IDS.has(abilityId);
}

function parseMove(playerId: string, { dx, dy }: Record<string, unknown>): Input | undefined {
  if (typeof dx !== 'number' || typeof dy !== 'number') return undefined;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length)) return undefined;
  if (length === 0) return { playerId, type: 'move', dx: 0, dy: 0 };
  return { playerId, type: 'move', dx: dx / length, dy: dy / length };
}

function parseTarget(playerId: string, { entityId }: Record<string, unknown>): Input | undefined {
  if (entityId !== null && typeof entityId !== 'string') return undefined;
  return { playerId, type: 'target', entityId };
}

function parseCast(playerId: string, { abilityId }: Record<string, unknown>): Input | undefined {
  return isPlayerAbilityId(abilityId) ? { playerId, type: 'cast', abilityId } : undefined;
}

const PARSERS: Readonly<Record<string, InputParser>> = { move: parseMove, target: parseTarget, cast: parseCast };

export function parsePlayerInput(playerId: string, type: string, payload: unknown): Input | undefined {
  const parser = Object.hasOwn(PARSERS, type) ? PARSERS[type] : undefined;
  return parser && isRecord(payload) ? parser(playerId, payload) : undefined;
}

export class InputQueue {
  private pending: Input[] = [];
  private readonly countsByPlayer = new Map<string, number>();

  enqueue(input: Input): boolean {
    const count = this.countsByPlayer.get(input.playerId) ?? 0;
    if (count >= INPUT_RULES.maxInputsPerPlayerPerTick) return false;
    this.countsByPlayer.set(input.playerId, count + 1);
    this.pending.push(input);
    return true;
  }

  drain(): Input[] {
    const drained = this.pending;
    this.pending = [];
    this.countsByPlayer.clear();
    return drained;
  }
}

export function isCastTimeAbility(abilityId: PlayerAbilityId): boolean {
  return CAST_TIME_ABILITY_IDS.has(abilityId);
}

export function parseDestination(payload: unknown): { x: number; y: number } | undefined {
  if (!isRecord(payload)) return undefined;
  const { x, y } = payload;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return { x, y };
}
