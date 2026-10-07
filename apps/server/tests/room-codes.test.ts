import { expect, test, vi } from 'vitest';
import { RoomCodePool, encodeRoomCode } from '../src/room-codes.js';

test('encodeRoomCode produces fixed-width uppercase base-26 codes', () => {
  expect(encodeRoomCode(0)).toBe('AAAA');
  expect(encodeRoomCode(26)).toBe('AABA');
  expect(encodeRoomCode(26 ** 4 - 1)).toBe('ZZZZ');
});

test('C5: reserve resolves collisions and wraps through the alphabet', () => {
  const random = vi.fn(() => 1 - Number.EPSILON);
  const codes = new RoomCodePool(random);
  expect(codes.reserve()).toBe('ZZZZ');
  expect(codes.reserve()).toBe('AAAA');
  expect(random).toHaveBeenCalledTimes(2);
});

test('release makes a disposed room code available again', () => {
  const codes = new RoomCodePool(() => 0);
  const code = codes.reserve();
  codes.release(code);
  expect(codes.reserve()).toBe(code);
});

test('reserve rejects a full namespace without looping indefinitely', () => {
  let index = 0;
  const codes = new RoomCodePool(() => index++ / 26 ** 4);
  for (let room = 0; room < 26 ** 4; room += 1) codes.reserve();
  expect(() => codes.reserve()).toThrow('No hay códigos de sala disponibles.');
});
