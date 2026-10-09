import { expect, test } from 'vitest';
import { LobbyView } from '../src/lobby-view';
import { lobbyFixture } from './lobby-fixtures';
import { lobbyDocument, type domElement } from './lobby-dom-fixtures';
import { attemptEvents, attemptSnapshot } from './attempt-fixtures';

test.each(['victory', 'defeat'] as const)('controller receives early and late events for %s and clears for retry', async (status) => {
  const fixture = lobbyFixture();
  await fixture.controller.createRoom();
  fixture.messages.get('events')!(attemptEvents.slice(0, 1));
  fixture.states[0]({ toJSON: () => ({}) });
  fixture.receive(attemptSnapshot);
  fixture.receive({ ...attemptSnapshot, status });
  expect(fixture.latest().summaryRows[0].cells[1]).toBe('140');
  fixture.messages.get('events')!(attemptEvents.slice(1));
  expect(fixture.latest().summaryRows[0].cells[1]).toBe('245');
  fixture.receive({ ...attemptSnapshot, status: 'lobby' });
  expect(fixture.latest().summaryRows).toEqual([]);
  fixture.receive(attemptSnapshot);
  expect(fixture.latest().summaryRows[0].cells[1]).toBe('0');
});

test('result renders all cells as text, highlights only self and includes bot comparison', async () => {
  const fixture = lobbyFixture('', attemptSnapshot);
  await fixture.controller.createRoom();
  fixture.messages.get('events')!(attemptEvents);
  fixture.receive({ ...attemptSnapshot, status: 'defeat' });
  const { document, element } = lobbyDocument();
  new LobbyView(document, '').render(fixture.latest());
  const rows = element('attempt-rows').replaceChildren.mock.calls[0] as ReturnType<typeof domElement>[];
  expect(rows).toHaveLength(3);
  expect(rows[0].setAttribute).toHaveBeenCalledWith('class', 'attempt-self');
  expect(rows[1].setAttribute).toHaveBeenCalledWith('class', '');
  expect(rows[0].replaceChildren.mock.calls[0].map((cell: { textContent: string }) => cell.textContent)).toEqual(fixture.latest().summaryRows[0].cells);
  expect(element('bot-reference').textContent).toBe('Referencia de bots perfectos (3 jugadores): Jaguar 25 DPS · Águila 58 DPS · Tícitl 27 HPS');
});
