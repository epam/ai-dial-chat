import type { Stage } from '@epam/ai-dial-chat-shared';

/** Returns the last stage with `status: null` (the currently executing stage), or `undefined` if none exists. */
export const findLiveStage = (stages: Stage[]): Stage | undefined =>
  [...stages].reverse().find((stage) => stage.status == null);
