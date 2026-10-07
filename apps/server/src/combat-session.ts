import type { CombatEvent, EncounterState, Input, removePlayer, step } from '@mictlan/core';
import { COMBAT_LOOP_RULES, consumeTicks } from './combat-clock.js';
import { InputQueue, isCastTimeAbility, parseDestination, parsePlayerInput } from './inputs.js';
import { MovementOrders } from './movement-orders.js';

export type CoreStep = typeof step;
export type CoreRemovePlayer = typeof removePlayer;

export class CombatSession {
  private accumulatedMs = 0;
  private readonly queue = new InputQueue();
  private readonly movement = new MovementOrders();
  private readonly playerIds: ReadonlySet<string>;

  constructor(
    private current: EncounterState, private readonly coreStep: CoreStep, private readonly coreRemovePlayer: CoreRemovePlayer,
  ) {
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
    if (type === 'moveTo') this.walkTo(playerId, payload);
    else if (type === 'stop') this.movement.stop(playerId);
    else this.receiveInput(parsePlayerInput(playerId, type, payload));
  }

  private walkTo(playerId: string, payload: unknown): void {
    const destination = parseDestination(payload);
    if (destination) this.movement.goTo(playerId, destination);
  }

  private receiveInput(input: Input | undefined): void {
    if (input?.type === 'move') return this.movement.hold(input);
    // Click-to-move (T3.7): asking for a cast-time ability stops the player so the cast can start.
    if (input?.type === 'cast' && isCastTimeAbility(input.abilityId)) this.movement.stop(input.playerId);
    if (input) this.queue.enqueue(input);
  }

  disconnect(playerId: string): CombatEvent[] {
    this.movement.stop(playerId);
    if (this.finished) return [];
    const result = this.coreRemovePlayer(this.current, playerId);
    this.current = result.state;
    return result.events;
  }

  advance(deltaMs: number): CombatEvent[] {
    const budget = consumeTicks(this.accumulatedMs, deltaMs);
    this.accumulatedMs = budget.accumulatedMs;
    const events: CombatEvent[] = [];
    for (let stepIndex = 0; stepIndex < budget.steps && !this.finished; stepIndex += 1) {
      const inputs = [...this.queue.drain(), ...this.movement.inputs(this.current)];
      const result = this.coreStep(this.current, inputs, COMBAT_LOOP_RULES.tickMs);
      this.current = result.state;
      events.push(...result.events);
    }
    return events;
  }
}
