import { schema, t, type SchemaType } from '@colyseus/schema';
import type { ClassId, EncounterStatus } from '@mictlan/core';

export const LobbyPlayerState = schema({
  id: t.string(),
  classId: t.string<ClassId | ''>().default(''),
  ready: t.boolean().default(false),
}, 'LobbyPlayerState');
export type LobbyPlayerState = SchemaType<typeof LobbyPlayerState>;

export const LobbyState = schema({
  status: t.string<EncounterStatus>().default('lobby'),
  code: t.string().default(''),
  players: t.map(LobbyPlayerState),
}, 'LobbyState');
export type LobbyState = SchemaType<typeof LobbyState>;
