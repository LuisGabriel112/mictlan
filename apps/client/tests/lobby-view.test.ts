import { expect, test, vi } from 'vitest';
import { LobbyView } from '../src/lobby-view';
import { lobbyDocument, domListener } from './lobby-dom-fixtures';
import { lobbyFixture, lobbySnapshot } from './lobby-fixtures';

test('view prefills code, binds create, submit, every class and ready to injected actions', () => {
  const { document, element } = lobbyDocument();
  const view = new LobbyView(document, 'ABCD');
  const actions = { createRoom: vi.fn(), joinRoom: vi.fn(), chooseClass: vi.fn(), ready: vi.fn() };
  view.bind(actions);
  expect(element('room-code').value).toBe('ABCD');
  domListener(element('create-room'), 'click')({} as Event);
  element('room-code').value = 'WXYZ';
  const preventDefault = vi.fn();
  domListener(element('join-form'), 'submit')({ preventDefault } as unknown as Event);
  for (const classId of ['jaguar', 'healer', 'eagle']) domListener(element(`class-${classId}`), 'click')({} as Event);
  domListener(element('ready'), 'click')({} as Event);
  expect(actions.createRoom).toHaveBeenCalledOnce();
  expect(actions.joinRoom).toHaveBeenCalledExactlyOnceWith('WXYZ');
  expect(preventDefault).toHaveBeenCalledOnce();
  expect(actions.chooseClass.mock.calls).toEqual([['jaguar'], ['healer'], ['eagle']]);
  expect(actions.ready).toHaveBeenCalledOnce();
});

test('view shows start, connection progress and recoverable errors without resetting typed code', async () => {
  const { document, element } = lobbyDocument();
  const view = new LobbyView(document, '');
  const fixture = lobbyFixture();
  await fixture.controller.start();
  view.render(fixture.latest());
  expect(element('start-screen').hidden).toBe(false);
  expect(element('lobby-screen').hidden).toBe(true);
  element('room-code').value = 'ZZZZ';
  view.render({ ...fixture.latest(), busy: true, error: 'La sala no existe. Revisa el código.' });
  expect(element('create-room').disabled).toBe(true);
  expect(element('join-room').disabled).toBe(true);
  expect(element('room-code').disabled).toBe(true);
  expect(element('room-code').value).toBe('ZZZZ');
  expect(element('connection-status').textContent).toBe('Conectando…');
  expect(element('error').textContent).toBe('La sala no existe. Revisa el código.');
});

test('view renders lobby players, missing roles and class selection', async () => {
  const { document, element } = lobbyDocument();
  const view = new LobbyView(document, '');
  const fixture = lobbyFixture('', lobbySnapshot());
  await fixture.controller.createRoom();
  view.render(fixture.latest());
  expect(element('shared-code').textContent).toBe('ABCD');
  expect(element('capacity').textContent).toBe('3 / 5 jugadores');
  expect(element('players').replaceChildren.mock.calls[0]).toHaveLength(3);
  expect(element('players').replaceChildren.mock.calls[0][0].textContent).toBe('Tú · Guerrero Jaguar · Sin preparar');
  expect(element('missing-roles').textContent).toBe('Falta Jaguar · Falta Tícitl · Falta al menos un Águila');
  expect(element('class-jaguar').setAttribute).toHaveBeenCalledWith('aria-pressed', 'true');
  expect(element('class-healer').setAttribute).toHaveBeenCalledWith('aria-pressed', 'false');
  expect(element('class-eagle').textContent).toBe('Guerrero Águila');
  expect(element('ready').textContent).toBe('Listo');
  expect(element('ready').disabled).toBe(false);
});

test('view checks ready only after confirmation and marks the complete composition', async () => {
  const { document, element } = lobbyDocument();
  const view = new LobbyView(document, '');
  const fixture = lobbyFixture('', lobbySnapshot());
  await fixture.controller.createRoom();
  fixture.receive(lobbySnapshot(true));
  view.render(fixture.latest());
  expect(element('ready').setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'true');
  expect(element('ready').textContent).toBe('Listo ✓');
  expect(element('ready').disabled).toBe(true);
  expect(element('class-jaguar').disabled).toBe(true);
  expect(element('missing-roles').textContent).toBe('Composición completa');
});

test('view reveals combat and covers result, then unchecks ready on lobby reset', async () => {
  const { document, element } = lobbyDocument();
  const view = new LobbyView(document, '');
  const fixture = lobbyFixture();
  await fixture.controller.createRoom();
  fixture.receive(lobbySnapshot(true, 'combat'));
  view.render(fixture.latest());
  expect(element('overlay').hidden).toBe(true);
  expect(element('game').inert).toBe(false);
  fixture.receive(lobbySnapshot(true, 'victory'));
  view.render(fixture.latest());
  expect(element('overlay').hidden).toBe(false);
  expect(element('game').inert).toBe(true);
  expect(element('result-screen').hidden).toBe(false);
  expect(element('result-title').textContent).toBe('¡Victoria!');
  expect(element('result-duration').textContent).toBe('Duración: 01:14');
});

test('view unchecks ready and hides result when the server resets the lobby', async () => {
  const { document, element } = lobbyDocument();
  const view = new LobbyView(document, '');
  const fixture = lobbyFixture('', lobbySnapshot(true, 'victory'));
  await fixture.controller.createRoom();
  view.render(fixture.latest());
  fixture.receive(lobbySnapshot());
  view.render(fixture.latest());
  expect(element('ready').setAttribute).toHaveBeenLastCalledWith('aria-pressed', 'false');
  expect(element('result-screen').hidden).toBe(true);
  expect(element('lobby-screen').hidden).toBe(false);
});

test('a missing required HTML control fails explicitly', () => {
  const { document, elements } = lobbyDocument();
  elements.delete('room-code');
  expect(() => new LobbyView(document, '')).toThrow('Missing lobby element: room-code');
});
