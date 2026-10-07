import { COMBAT_RULES, type EncounterState, type Input } from '@mictlan/core';

type MoveInput = Extract<Input, { type: 'move' }>;

export interface Destination {
  x: number;
  y: number;
}

// One tick of walking; closer than this the player is considered arrived (core only moves full steps).
const ARRIVAL_METERS = COMBAT_RULES.playerSpeedMetersPerSecond / COMBAT_RULES.ticksPerSecond;

// Destinations beyond the wall would make the player push against it forever, so they are pulled onto it.
function insideWall({ x, y }: Destination): Destination {
  const { center, wallRadiusMeters } = COMBAT_RULES.arena;
  const distance = Math.hypot(x - center.x, y - center.y);
  if (distance <= wallRadiusMeters) return { x, y };
  const scale = wallRadiusMeters / distance;
  return { x: center.x + (x - center.x) * scale, y: center.y + (y - center.y) * scale };
}

// SPEC §7/§10: a player either holds a direction or walks to a destination; both repeat every tick.
export class MovementOrders {
  private readonly held = new Map<string, MoveInput>();
  private readonly destinations = new Map<string, Destination>();

  hold(move: MoveInput): void {
    this.destinations.delete(move.playerId);
    if (move.dx === 0 && move.dy === 0) this.held.delete(move.playerId);
    else this.held.set(move.playerId, move);
  }

  goTo(playerId: string, destination: Destination): void {
    this.held.delete(playerId);
    this.destinations.set(playerId, insideWall(destination));
  }

  stop(playerId: string): void {
    this.held.delete(playerId);
    this.destinations.delete(playerId);
  }

  inputs(state: EncounterState): Input[] {
    const walking: Input[] = [];
    for (const [playerId, destination] of this.destinations) {
      const move = this.stepToward(state, playerId, destination);
      if (move) walking.push(move);
      else this.destinations.delete(playerId);
    }
    return [...this.held.values(), ...walking];
  }

  private stepToward(state: EncounterState, playerId: string, destination: Destination): MoveInput | undefined {
    const player = state.entities[playerId];
    if (!player || player.health <= 0) return undefined;
    const dx = destination.x - player.x;
    const dy = destination.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < ARRIVAL_METERS) return undefined;
    return { playerId, type: 'move', dx: dx / distance, dy: dy / distance };
  }
}
