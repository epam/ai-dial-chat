import { randomUUID } from 'node:crypto';

/** Returns a UUID v4 string. */
export const generateUUID = (): string => randomUUID();
