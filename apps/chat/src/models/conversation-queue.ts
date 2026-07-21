import type { ExportJobStatus } from '../types/conversation-export';

/**
 * A single entry in the shared import/export queue panel. Multiple jobs can
 * be in flight concurrently (e.g. exporting several conversations one after
 * another without waiting for the previous one to finish).
 */
export interface QueueJob {
  /** Unique job identifier, stable across status updates. */
  id: string;
  /** Display label — the conversation title, or the export-all label. */
  label: string;
  /**
   * Optional secondary line shown above the label (e.g. a source
   * folder-path breadcrumb like `Folder 1 / Folder 2`).
   */
  description?: string;
  /** Current lifecycle status. */
  status: ExportJobStatus;
}
