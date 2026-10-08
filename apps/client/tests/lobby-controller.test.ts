import { expect, test } from 'vitest';
import { lobbyFixture, lobbySnapshot } from './lobby-fixtures';
import { room } from './fixtures';

test('start prefills a share code without networking and create explicitly ignores that code', async () => {
  const fixture = lobbyFixture('?code=abcd');
  await fixture.controller.start();
  expect(fixture.latest()).toMatchObject({ screen: 'start', code: 'ABCD', busy: false, error: '', selectedClass: 'eagle' });
  expect(fixture.client.create).not.toHaveBeenCalled();
  expect(fixture.client.joinById).not.toHaveBeenCalled();
  await fixture.controller.createRoom();
  expect(fixture.client.create).toHaveBeenCalledWith('raid');
  expect(fixture.connected).toHaveBeenCalledExactlyOnceWith(fixture.connection);
  expect(fixture.latest()).toMatchObject({ screen: 'lobby', code: 'ABCD', players: [], ready: false });
  await fixture.controller.createRoom();
  expect(fixture.client.create).toHaveBeenCalledTimes(1);
});

test('join normalizes whitespace and case, and reads an already delivered initial snapshot', async () => {
  const fixture = lobbyFixture('', lobbySnapshot());
  await fixture.controller.joinRoom(' abcd ');
  expect(fixture.client.joinById).toHaveBeenCalledWith('ABCD');
  expect(fixture.latest()).toMatchObject({ screen: 'lobby', selectedClass: 'jaguar', ready: false });
  expect(fixture.latest().players).toHaveLength(3);
  expect(fixture.latest().capacity).toBe('3 / 5 jugadores');
  expect(fixture.connection.send).not.toHaveBeenCalled();
});

test.each(['', 'ABC', 'ABCDE', '1234', 'A<BC'])('invalid code %s never creates or joins a room', async (code) => {
  const fixture = lobbyFixture();
  await fixture.controller.joinRoom(code);
  expect(fixture.latest().error).toBe('Escribe un código de cuatro letras.');
  expect(fixture.client.joinById).not.toHaveBeenCalled();
  expect(fixture.client.create).not.toHaveBeenCalled();
});

test.each([
  [{ code: 522, message: 'room "ZZZZ" not found' }, 'La sala no existe. Revisa el código.'],
  [{ code: 522, message: 'room "ZZZZ" is locked' }, 'La sala está llena o ya inició el combate.'],
  [{ code: 521 }, 'No se pudo conectar al servidor. Inténtalo de nuevo.'],
])('connection failure %j leaves start usable for retry and ignores duplicate clicks', async (error, expected) => {
  const fixture = lobbyFixture();
  fixture.client.joinById.mockRejectedValueOnce(error);
  const pending = fixture.controller.joinRoom('ZZZZ');
  expect(fixture.latest().busy).toBe(true);
  await fixture.controller.createRoom();
  expect(fixture.client.create).not.toHaveBeenCalled();
  await pending;
  expect(fixture.latest()).toMatchObject({ screen: 'start', busy: false, error: expected });
  expect(fixture.connected).not.toHaveBeenCalled();
  await fixture.controller.createRoom();
  expect(fixture.latest()).toMatchObject({ screen: 'lobby', busy: false, error: '' });
});

test('chooseClass and ready wait for the server; second Jaguar rejection allows another choice', async () => {
  const fixture = lobbyFixture();
  fixture.controller.ready();
  expect(fixture.connection.send).not.toHaveBeenCalled();
  await fixture.controller.createRoom();
  fixture.controller.ready();
  expect(fixture.connection.send).not.toHaveBeenCalled();
  fixture.receive(room([], { status: 'lobby' }));
  fixture.controller.chooseClass('jaguar');
  fixture.receive(room([], { status: 'lobby' }));
  fixture.controller.ready();
  expect(fixture.connection.send).toHaveBeenCalledExactlyOnceWith('ready', { classId: 'jaguar' });
  expect(fixture.latest().ready).toBe(false);
  fixture.messages.get('rejected')!({ reason: 'composition' });
  expect(fixture.latest().error).toBe('Ese rol ya está ocupado');
  fixture.controller.chooseClass('healer');
  expect(fixture.latest()).toMatchObject({ selectedClass: 'healer', error: '' });
  fixture.controller.ready();
  expect(fixture.connection.send).toHaveBeenLastCalledWith('ready', { classId: 'healer' });
});

test.each(['victory', 'defeat'] as const)('three-player flow: lobby → combat → %s → lobby', async (status) => {
  const fixture = lobbyFixture('', lobbySnapshot());
  await fixture.controller.createRoom();
  fixture.controller.ready();
  fixture.receive(lobbySnapshot(true));
  expect(fixture.latest()).toMatchObject({ ready: true, missing: [], selectedClass: 'jaguar' });
  fixture.controller.chooseClass('healer');
  fixture.controller.ready();
  expect(fixture.connection.send).toHaveBeenCalledTimes(1);
  expect(fixture.latest().selectedClass).toBe('jaguar');
  fixture.receive(lobbySnapshot(true, 'combat'));
  expect(fixture.latest().screen).toBe('combat');
  fixture.controller.ready();
  fixture.controller.chooseClass('healer');
  expect(fixture.latest().selectedClass).toBe('jaguar');
  fixture.receive(lobbySnapshot(true, status));
  expect(fixture.latest()).toMatchObject({ screen: 'result', duration: '01:14', title: status === 'victory' ? '¡Victoria!' : 'Derrota' });
  fixture.receive(lobbySnapshot());
  expect(fixture.latest()).toMatchObject({ screen: 'lobby', ready: false, selectedClass: 'jaguar', error: '' });
});

test('a new ready request after reset starts preparing the next attempt', async () => {
  const fixture = lobbyFixture('', lobbySnapshot(true, 'defeat'));
  await fixture.controller.createRoom();
  fixture.receive(lobbySnapshot());
  fixture.controller.ready();
  expect(fixture.connection.send).toHaveBeenCalledExactlyOnceWith('ready', { classId: 'jaguar' });
});

test('dev mode keeps automatic join and ready, hides both lobbies and still shows the result', async () => {
  const fixture = lobbyFixture('?dev=1&class=healer&code=ZZZZ');
  await fixture.controller.start();
  expect(fixture.client.joinOrCreate).toHaveBeenCalledWith('raid');
  expect(fixture.connection.send).toHaveBeenCalledWith('ready', { classId: 'healer' });
  expect(fixture.latest().screen).toBe('combat');
  fixture.receive(lobbySnapshot(true, 'defeat'));
  expect(fixture.latest().screen).toBe('result');
  fixture.receive(lobbySnapshot());
  expect(fixture.latest().screen).toBe('combat');
});

// Colyseus creates room.state before the first patch arrives; its toJSON() is then {}.
test('an unsynchronized initial state is ignored until the first full snapshot arrives', async () => {
  const fixture = lobbyFixture('', {} as ReturnType<typeof lobbySnapshot>);
  await fixture.controller.createRoom();
  expect(fixture.latest()).toMatchObject({ screen: 'lobby', players: [], ready: false });
  fixture.states.forEach((callback) => callback({ toJSON: () => ({}) }));
  expect(fixture.latest().players).toEqual([]);
  fixture.receive(lobbySnapshot(false, 'combat'));
  expect(fixture.latest()).toMatchObject({ screen: 'combat' });
});
