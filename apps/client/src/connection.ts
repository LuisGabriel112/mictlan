import type { LaunchParams } from './launch-params';

export interface RaidRoomConnection {
  send(type: string, payload?: unknown): void;
}

export interface RaidClient<Room extends RaidRoomConnection = RaidRoomConnection> {
  joinOrCreate(roomName: string): Promise<Room>;
  create(roomName: string): Promise<Room>;
  joinById(roomId: string): Promise<Room>;
}

const RAID_ROOM = 'raid';

export async function connectToRaid<Room extends RaidRoomConnection>(
  params: LaunchParams, client: RaidClient<Room>,
): Promise<Room> {
  if (params.dev) {
    const room = await client.joinOrCreate(RAID_ROOM);
    room.send('ready', { classId: params.classId });
    return room;
  }
  return params.code ? client.joinById(params.code) : client.create(RAID_ROOM);
}
