import { CLASSES, type ClassId } from '@mictlan/core';
import { centerDistance, isLiving, type EntitySnapshot, type Point, type RoomSnapshot } from './snapshot';

// UI threshold, not a game number: enough to prove the player found right-click walking.
const MOVE_PROOF_METERS = 1;

export interface TutorialProgress {
  stepIndex: number;
  insideZone: boolean;
  anchor?: Point;
}

export interface TutorialPrompt {
  counter: string;
  text: string;
}

type StepCheck = (progress: TutorialProgress, self: EntitySnapshot, snapshot: RoomSnapshot) => TutorialProgress;

interface TutorialStep {
  text: (classId: ClassId) => string;
  check: StepCheck;
}

const STEPS: readonly TutorialStep[] = [
  { text: () => 'Selecciona al jefe: haz clic sobre él o pulsa Tab.', check: checkBossSelected },
  { text: () => 'Camina: haz clic derecho en el suelo. S te detiene.', check: checkMoved },
  { text: (classId) => `Lanza ${CLASSES[classId].abilities[0].name} con Q. Pulsa H para ver tu rotación.`, check: checkAbilityUsed },
  { text: () => 'Si un círculo rojo de Viento de obsidiana te alcanza, sal caminando antes de que estalle.', check: checkLeftZone },
];

export function startTutorial(): TutorialProgress {
  return { stepIndex: 0, insideZone: false };
}

export function isTutorialDone(progress: TutorialProgress): boolean {
  return progress.stepIndex >= STEPS.length;
}

export function tutorialPrompt(progress: TutorialProgress, classId: ClassId): TutorialPrompt | undefined {
  const step = STEPS[progress.stepIndex];
  if (!step) return undefined;
  return { counter: `Paso ${progress.stepIndex + 1}/${STEPS.length}`, text: step.text(classId) };
}

export function advanceTutorial(progress: TutorialProgress, snapshot: RoomSnapshot, selfId: string): TutorialProgress {
  const self = snapshot.entities[selfId];
  const step = STEPS[progress.stepIndex];
  if (!self || !step) return progress;
  return step.check(progress, self, snapshot);
}

function nextStep(progress: TutorialProgress): TutorialProgress {
  return { stepIndex: progress.stepIndex + 1, insideZone: false };
}

function checkBossSelected(progress: TutorialProgress, self: EntitySnapshot, snapshot: RoomSnapshot): TutorialProgress {
  return snapshot.entities[self.targetId]?.type === 'boss' ? nextStep(progress) : progress;
}

function checkMoved(progress: TutorialProgress, self: EntitySnapshot): TutorialProgress {
  if (!progress.anchor) return { ...progress, anchor: { x: self.x, y: self.y } };
  return centerDistance(progress.anchor, self) >= MOVE_PROOF_METERS ? nextStep(progress) : progress;
}

function checkAbilityUsed(progress: TutorialProgress, self: EntitySnapshot): TutorialProgress {
  return self.gcdRemainingTicks > 0 || self.cast ? nextStep(progress) : progress;
}

function checkLeftZone(progress: TutorialProgress, self: EntitySnapshot, snapshot: RoomSnapshot): TutorialProgress {
  if (!isLiving(self)) return { ...progress, insideZone: false };
  const inside = Object.values(snapshot.zones).some((zone) => centerDistance(zone, self) <= zone.radiusMeters);
  if (progress.insideZone && !inside) return nextStep(progress);
  return { ...progress, insideZone: inside };
}
