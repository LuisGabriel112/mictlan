import type { CombatEvent, EncounterState, step } from '@mictlan/core';
import { COMBAT_LOOP_RULES, consumeTicks } from './combat-clock.js';
import { InputQueue, parsePlayerInput } from './inputs.js';

export type CoreStep = typeof step;

export class CombatSession {
  private accumulatedMs = 0;
  private readonly queue = new InputQueue();
  private readonly playerIds: ReadonlySet<string>;

  constructor(private current: EncounterState, private readonly coreStep: CoreStep) {
    this.playerIds = new Set(current.config.players.map(({ id }) => id));
  }

  get state(): EncounterState {
    return this.current;
  }

  get finished(): boolean {
    return this.current.status !== 'combat';
  }

  receive(playerId: string, type: string, payload: unknown): void {
    if (this.finished || !this.playerIds.has(playerId)) return;
    const input = parsePlayerInput(playerId, type, payload);
    if (input) this.queue.enqueue(input);
  }

  advance(deltaMs: number): CombatEvent[] {
    const budget = consumeTicks(this.accumulatedMs, deltaMs);
    this.accumulatedMs = budget.accumulatedMs;
    const events: CombatEvent[] = [];
    for (let stepIndex = 0; stepIndex < budget.steps && !this.finished; stepIndex += 1) {
      const result = this.coreStep(this.current, this.queue.drain(), COMBAT_LOOP_RULES.tickMs);
      this.current = result.state;
      events.push(...result.events);
    }
    return events;
  }
}
