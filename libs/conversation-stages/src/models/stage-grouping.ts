import type { Stage } from '@epam/ai-dial-chat-shared';

/** A row rendered inside a `StagesPanel` — either one stage or a collapsed `×N` group of identical attempts. */
export interface StageRow {
  /** Stable key for list rendering — the first attempt's index. */
  key: number;
  /** Shared cleaned display name for the group. */
  name?: string;
  /** The single stage for this row (present only when there is one attempt). */
  stage?: Stage;
  /** Individual attempts in original order. */
  attempts?: Stage[];
}
