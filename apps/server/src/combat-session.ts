import type { CombatEvent, EncounterState, Input, removePlayer, step } from '@mictlan/core';
import { COMBAT_LOOP_RULES, consumeTicks } from './combat-clock.js';
import { InputQueue, parsePlayerInput } from './inputs.js';

export type CoreStep = typeof step;
export type CoreRemovePlayer = typeof removePlayer;

export class CombatSession {
  private accumulatedMs = 0;
  private readonly queue = new InputQueue();
  // SPEC §7: a move is a held direction; it repeats every tick until the client sends (0,0).
  private readonly heldMoves = new Map<string, Input>();
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
    const input = parsePlayerInput(playerId, type, payload);
    if (input?.type === 'move') this.holdMove(input);
    else if (input) this.queue.enqueue(input);
  }

  private holdMove(move: Extract<Input, { type: 'move' }>): void {
    if (move.dx === 0 && move.dy === 0) this.heldMoves.delete(move.playerId);
    else this.heldMoves.set(move.playerId, move);
  }

  disconnect(playerId: string): CombatEvent[] {
    this.heldMoves.delete(playerId);
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
      const inputs = [...this.queue.drain(), ...this.heldMoves.values()];
      const result = this.coreStep(this.current, inputs, COMBAT_LOOP_RULES.tickMs);
      this.current = result.state;
      events.push(...result.events);
    }
    return events;
  }
}
