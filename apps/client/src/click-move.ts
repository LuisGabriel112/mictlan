import { centerDistance, type Point } from './snapshot';

// The server stops within one 0.35 m step of the destination; a bit of slack hides the marker on arrival.
export const ARRIVAL_RADIUS_METERS = 0.5;

export class DestinationMarker {
  private destination?: Point;

  get position(): Point | undefined {
    return this.destination;
  }

  set(destination: Point): void {
    this.destination = destination;
  }

  clear(): void {
    this.destination = undefined;
  }

  visibleAt(selfPosition: Point | undefined): boolean {
    if (!this.destination) return false;
    if (selfPosition && centerDistance(selfPosition, this.destination) <= ARRIVAL_RADIUS_METERS) this.clear();
    return this.destination !== undefined;
  }
}
