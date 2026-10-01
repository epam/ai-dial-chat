import type { StageNode } from './stage-tree';

/** A row rendered inside one sibling list — either one stage node or a collapsed `×N` group of identical attempts. */
export interface StageRow {
  /** Stable key for list rendering — the first attempt's index. */
  key: number;
  /** Shared cleaned display name for the group. */
  name?: string;
  /** The single stage node for this row (present only when there is one attempt). */
  node?: StageNode;
  /** Individual attempts in original order, each keeping its own descendants. */
  attempts?: StageNode[];
}
