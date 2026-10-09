import { isSyncedSnapshot, type RoomSnapshot } from './snapshot';
import { advanceTutorial, isTutorialDone, startTutorial, tutorialPrompt, type TutorialProgress, type TutorialPrompt } from './tutorial-steps';

const FINISHED_KEY = 'mictlan.tutorial.finished';

export interface TutorialRoom {
  readonly sessionId: string;
  onStateChange(callback: (state: { toJSON(): unknown }) => void): unknown;
}

export interface TutorialStore {
  isFinished(): boolean;
  markFinished(): void;
}

interface TutorialPanel {
  render(prompt: TutorialPrompt | undefined): void;
  onSkip(callback: () => void): void;
}

type KeyTarget = { addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void };
type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

// Private windows and blocked site data throw on access; the tutorial must still run there.
export function browserTutorialStore(storage: () => FlagStorage | undefined): TutorialStore {
  return {
    isFinished: () => { try { return storage()?.getItem(FINISHED_KEY) === '1'; } catch { return false; } },
    markFinished: () => { try { storage()?.setItem(FINISHED_KEY, '1'); } catch { /* best effort */ } },
  };
}

export class TutorialController {
  private progress?: TutorialProgress;

  constructor(private readonly room: TutorialRoom, private readonly store: TutorialStore,
    private readonly panel: TutorialPanel, keys: KeyTarget) {
    if (!store.isFinished()) this.progress = startTutorial();
    panel.onSkip(() => this.finish());
    keys.addEventListener('keydown', (event) => this.handleKey(event));
    room.onStateChange((state) => this.receiveState(state.toJSON()));
  }

  private handleKey(event: Pick<KeyboardEvent, 'code' | 'repeat'>): void {
    if (event.code === 'KeyT' && !event.repeat) this.progress = startTutorial();
  }

  private receiveState(snapshot: unknown): void {
    if (!isSyncedSnapshot(snapshot)) return;
    if (snapshot.status !== 'combat' || !this.progress) return this.panel.render(undefined);
    this.progress = advanceTutorial(this.progress, snapshot, this.room.sessionId);
    if (isTutorialDone(this.progress)) return this.finish();
    this.panel.render(this.promptFor(snapshot));
  }

  private promptFor(snapshot: RoomSnapshot): TutorialPrompt | undefined {
    const classId = snapshot.entities[this.room.sessionId]?.classId;
    return this.progress && classId ? tutorialPrompt(this.progress, classId) : undefined;
  }

  private finish(): void {
    this.progress = undefined;
    this.store.markFinished();
    this.panel.render(undefined);
  }
}
