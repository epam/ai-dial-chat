import { newYearEvent } from './event';

export { newYearEvent } from './event';
export { NEW_YEAR_LABELS } from './constants/labels';
export type { NewYearLabels } from './models/labels';
export { NewYearScene } from './types/new-year';

/* The default export lets hosts pass `() => import('…/new-year')` as a loader. */
export default newYearEvent;
