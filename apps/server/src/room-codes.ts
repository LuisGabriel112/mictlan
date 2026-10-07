const ROOM_CODE_RULES = { alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', length: 4 } as const;
const CODE_CAPACITY = ROOM_CODE_RULES.alphabet.length ** ROOM_CODE_RULES.length;

export function encodeRoomCode(index: number): string {
  let code = '';
  for (let letter = 0; letter < ROOM_CODE_RULES.length; letter += 1) {
    code = ROOM_CODE_RULES.alphabet[index % ROOM_CODE_RULES.alphabet.length] + code;
    index = Math.floor(index / ROOM_CODE_RULES.alphabet.length);
  }
  return code;
}

export class RoomCodePool {
  private readonly activeCodes = new Set<string>();

  constructor(private readonly random: () => number) {}

  reserve(): string {
    if (this.activeCodes.size === CODE_CAPACITY) throw new Error('No hay códigos de sala disponibles.');
    let index = Math.floor(this.random() * CODE_CAPACITY);
    while (this.activeCodes.has(encodeRoomCode(index))) index = (index + 1) % CODE_CAPACITY;
    const code = encodeRoomCode(index);
    this.activeCodes.add(code);
    return code;
  }

  release(code: string): void {
    this.activeCodes.delete(code);
  }
}
