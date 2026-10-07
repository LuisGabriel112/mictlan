import { schema, t, type SchemaType } from '@colyseus/schema';
import type { ClassId, EncounterStatus, Phase } from '@mictlan/core';
import { EntityState, ZoneState } from './CombatState.js';

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
  entities: t.map(EntityState),
  zones: t.map(ZoneState),
  phase: t.number<Phase | 0>().default(0),
  safeRadiusMeters: t.number().default(0),
  elapsedTicks: t.number().default(0),
  tick: t.number().default(0),
}, 'LobbyState');
export type LobbyState = SchemaType<typeof LobbyState>;
