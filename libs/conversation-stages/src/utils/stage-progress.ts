import type { Stage } from '@epam/ai-dial-chat-shared';

/**
 * Finds the currently-executing stage while a run is streaming: the last
 * entry with `status: null`. Returns `undefined` once every stage has
 * settled (or the list is empty), even if the caller still reports
 * `isStreaming: true` — a transitional state between the last stage settling
 * and the stream closing.
 */
export const findLiveStage = (stages: Stage[]): Stage | undefined =>
  [...stages].reverse().find((stage) => stage.status == null);

/** 1-based position of `stage` within `stages`, by its stable `index` field. */
export const stagePosition = (stages: Stage[], stage: Stage): number =>
  stages.findIndex((s) => s.index === stage.index) + 1;
