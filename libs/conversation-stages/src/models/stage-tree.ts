import type { Stage } from '@epam/ai-dial-chat-shared';

/** One stage in the display hierarchy derived from `parent_stage_index`. */
export interface StageNode {
  /** The original normalized stage; never mutated. */
  stage: Stage;
  /** Child nodes in their input encounter order. */
  children: StageNode[];
}

/** Panel-local disclosure state, keyed by stable stage identity. */
export interface StageExpansion {
  /** Returns whether the disclosure with this key is expanded. */
  isExpanded: (key: string) => boolean;
  /** Records the user's expand/collapse choice for this key. */
  onToggle: (key: string, isExpanded: boolean) => void;
}

/** Disclosure state together with the owner's ability to discard every choice. */
export interface StageExpansionState extends StageExpansion {
  /** Collapses every disclosure, e.g. when the surrounding panel unmounts. */
  reset: () => void;
}
