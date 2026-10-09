import { CLASSES, PARTY_RULES, type ClassId } from '@mictlan/core';
import { LOBBY_CLASSES, missingRolesText, resultText, type ClientScreen, type LobbySelection } from './lobby';
import type { RoomSnapshot } from './snapshot';

interface LobbyActions {
  create(): void;
  join(code: string): void;
  choose(classId: ClassId): void;
  ready(): void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function button(label: string, action: () => void): HTMLButtonElement {
  const node = element('button', label);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

export class LobbyView {
  private readonly root = element('main');
  private readonly start = element('section');
  private readonly lobby = element('section');
  private readonly result = element('section');
  private readonly error = element('p');
  private readonly code = element('p');
  private readonly players = element('ul');
  private readonly roles = element('p');
  private readonly readyButton: HTMLButtonElement;
  private readonly classButtons = new Map<ClassId, HTMLButtonElement>();
  private readonly resultTitle = element('h1');
  private readonly duration = element('p');

  constructor(initialCode: string, private readonly actions: LobbyActions) {
    this.root.id = 'lobby-ui';
    this.error.setAttribute('role', 'alert');
    this.error.className = 'lobby-error';
    this.buildStart(initialCode);
    this.readyButton = button('Listo', actions.ready);
    this.readyButton.disabled = true;
    this.buildLobby();
    this.result.append(this.resultTitle, this.duration, element('p', 'Volviendo al lobby…'));
    this.root.append(this.start, this.lobby, this.result, this.error);
    document.body.append(this.root);
  }

  show(screen: ClientScreen, error = ''): void {
    this.root.hidden = screen === 'arena';
    this.start.hidden = screen !== 'start';
    this.lobby.hidden = screen !== 'lobby';
    this.result.hidden = screen !== 'result';
    this.error.textContent = error;
  }

  setConnecting(connecting: boolean): void {
    this.start.querySelectorAll('button, input').forEach((node) => {
      if (node instanceof HTMLButtonElement || node instanceof HTMLInputElement) node.disabled = connecting;
    });
    this.start.setAttribute('aria-busy', String(connecting));
    this.error.textContent = connecting ? 'Conectando…' : '';
  }

  update(snapshot: RoomSnapshot, selfId: string, selection: LobbySelection): void {
    this.code.textContent = snapshot.code;
    const players = Object.values(snapshot.players);
    this.players.replaceChildren(...players.map((player, index) => element('li',
      `Jugador ${index + 1}${player.id === selfId ? ' (tú)' : ''} · ${player.classId ? CLASSES[player.classId].name : 'Sin clase'} · ${player.ready ? 'Listo' : 'No listo'}`)));
    this.roles.textContent = `${players.length}/${PARTY_RULES.maxPlayers} jugadores · ${missingRolesText(players)}`;
    for (const [classId, node] of this.classButtons) {
      node.setAttribute('aria-pressed', String(selection.classId === classId));
      node.disabled = selection.ready;
    }
    this.readyButton.disabled = selection.ready || !snapshot.players[selfId];
    this.readyButton.textContent = selection.ready ? 'Listo ✓' : 'Listo';
    if (snapshot.status === 'victory' || snapshot.status === 'defeat') {
      const result = resultText(snapshot);
      this.resultTitle.textContent = result.title;
      this.duration.textContent = result.duration;
    }
  }

  private buildStart(initialCode: string): void {
    const input = element('input');
    input.id = 'room-code';
    input.name = 'code';
    input.value = initialCode;
    input.maxLength = 4;
    input.pattern = '[A-Za-z]{4}';
    input.required = true;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
    const label = element('label', 'Código de sala (4 letras)');
    label.htmlFor = input.id;
    const form = element('form');
    const join = element('button', 'Unirse');
    join.type = 'submit';
    form.append(label, input, join);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.actions.join(input.value.trim().toUpperCase());
    });
    this.start.append(element('h1', 'Mictlán'), button('Crear sala', this.actions.create), form);
  }

  private buildLobby(): void {
    this.code.className = 'room-code';
    this.code.setAttribute('aria-label', 'Código de sala');
    const classes = element('div');
    classes.className = 'class-options';
    classes.setAttribute('role', 'group');
    classes.setAttribute('aria-label', 'Elige tu clase');
    for (const classId of LOBBY_CLASSES) {
      const node = button(CLASSES[classId].name, () => this.actions.choose(classId));
      this.classButtons.set(classId, node);
      classes.append(node);
    }
    this.lobby.append(element('h1', 'Sala'), this.code, element('p', 'Comparte este código para invitar a tu grupo.'),
      this.players, this.roles, element('p', 'Roles confirmados al pulsar Listo. La partida comienza cuando todos están listos.'),
      classes, this.readyButton);
  }
}
