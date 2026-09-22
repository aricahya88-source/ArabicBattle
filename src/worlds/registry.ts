import { STUDENT_ROOM } from './studentRoom';
export const WORLD_REGISTRY = { [STUDENT_ROOM.id]: STUDENT_ROOM } as const;
export type WorldId = keyof typeof WORLD_REGISTRY;
