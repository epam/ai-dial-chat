import type { PinnedProjectActionKind } from '../types/pinned-project-action';

/** The overlay a pinned project's sidebar menu opened, kept after closing so the publish panel can slide out. */
export interface PinnedProjectActionState {
  /** Which overlay the action opened. */
  kind: PinnedProjectActionKind;
  /** The project's DIAL id. */
  projectId: string;
  /** Whether the overlay is open. */
  isOpen: boolean;
}
