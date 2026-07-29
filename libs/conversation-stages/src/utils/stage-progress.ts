import type { Stage } from '@epam/ai-dial-chat-shared';

/** Returns the last stage with `status: null` (the currently executing stage), or `undefined` if none exists. */
export const findLiveStage = (stages: Stage[]): Stage | undefined =>
  [...stages].reverse().find((stage) => stage.status == null);

/** 1-based position of `stage` within `stages`, by its stable `index` field. */
export const stagePosition = (stages: Stage[], stage: Stage): number =>
  stages.findIndex((s) => s.index === stage.index) + 1;
