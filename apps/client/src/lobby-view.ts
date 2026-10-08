import { CLASSES, type ClassId } from '@mictlan/core';
import type { LobbyModel } from './lobby-controller';

interface LobbyActions {
  createRoom(): Promise<void>;
  joinRoom(code: string): Promise<void>;
  chooseClass(classId: ClassId): void;
  ready(): void;
}

export class LobbyView {
  constructor(private readonly document: Document, code: string) {
    this.element<HTMLInputElement>('room-code').value = code;
  }

  bind(actions: LobbyActions): void {
    this.element('create-room').addEventListener('click', () => actions.createRoom());
    this.element('join-form').addEventListener('submit', (event) => {
      event.preventDefault();
      return actions.joinRoom(this.element<HTMLInputElement>('room-code').value);
    });
    for (const classId of Object.keys(CLASSES) as ClassId[]) {
      this.element(`class-${classId}`).addEventListener('click', () => actions.chooseClass(classId));
    }
    this.element('ready').addEventListener('click', () => actions.ready());
  }

  render(model: LobbyModel): void {
    this.element('overlay').hidden = model.screen === 'combat';
    this.element('game').inert = model.screen !== 'combat';
    for (const screen of ['start', 'lobby', 'result']) this.element(`${screen}-screen`).hidden = screen !== model.screen;
    this.element('error').textContent = model.error;
    this.renderConnection(model.busy);
    if (model.screen === 'lobby') this.renderLobby(model);
    if (model.screen === 'result') this.renderResult(model);
  }

  private renderConnection(busy: boolean): void {
    for (const id of ['create-room', 'join-room', 'room-code']) this.element<HTMLButtonElement>(id).disabled = busy;
    this.element('connection-status').textContent = busy ? 'Conectando…' : '';
  }

  private renderLobby(model: LobbyModel): void {
    this.element('shared-code').textContent = model.code;
    this.element('capacity').textContent = model.capacity;
    this.element('players').replaceChildren(...model.players.map((label) => this.playerRow(label)));
    this.element('missing-roles').textContent = model.missing.length ? model.missing.join(' · ') : 'Composición completa';
    this.renderClasses(model);
    const ready = this.element<HTMLButtonElement>('ready');
    ready.disabled = model.ready;
    ready.setAttribute('aria-pressed', String(model.ready));
    ready.textContent = model.ready ? 'Listo ✓' : 'Listo';
  }

  private renderClasses(model: LobbyModel): void {
    for (const definition of Object.values(CLASSES)) {
      const button = this.element<HTMLButtonElement>(`class-${definition.id}`);
      button.textContent = definition.name;
      button.disabled = model.ready;
      button.setAttribute('aria-pressed', String(definition.id === model.selectedClass));
    }
  }

  private playerRow(label: string): HTMLLIElement {
    const item = this.document.createElement('li');
    item.textContent = label;
    return item;
  }

  private renderResult(model: LobbyModel): void {
    this.element('result-title').textContent = model.title;
    this.element('result-duration').textContent = `Duración: ${model.duration}`;
  }

  private element<Element extends HTMLElement>(id: string): Element {
    const element = this.document.getElementById(id);
    if (!element) throw new Error(`Missing lobby element: ${id}`);
    return element as Element;
  }
}
