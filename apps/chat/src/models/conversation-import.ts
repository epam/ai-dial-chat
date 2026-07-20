import type { ExportJob } from './conversation-export';

/**
 * A single entry in the shared import/export queue panel. Structurally
 * identical to `ExportJob` (same lifecycle statuses, same optional
 * folder-path `description` line) — kept as a distinct name for import
 * call sites rather than introducing a parallel status enum.
 */
export type ImportJob = ExportJob;
