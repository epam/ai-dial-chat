import { halloweenEvent } from './event';

export { createHalloweenEvent, halloweenEvent } from './event';
export type { HalloweenEventOptions } from './event';
export { HALLOWEEN_LABELS } from './constants/labels';
export type { HalloweenLabels } from './models/labels';
export { HalloweenDecorBehavior, HalloweenScene } from './types/halloween';

/* The default export lets hosts pass `() => import('…/halloween')` as a loader. */
export default halloweenEvent;
