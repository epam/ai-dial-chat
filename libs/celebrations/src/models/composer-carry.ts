import type { CelebrationSnapshotSession } from '../utils/celebration-snapshots';

/** The single composer copy prepared before a carry scene starts. */
export interface ComposerCarryPreparation {
  /** Prepared, initially detached copy. */
  copy: CelebrationSnapshotSession;
  /** Hooks attached only while the renderer owns this copy. */
  handlers: { onStop?: () => void };
}
