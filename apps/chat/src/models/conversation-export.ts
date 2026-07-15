import type { ExportJobStatus } from '../types/conversation-export';

/**
 * A single entry in the export queue/history panel. Multiple jobs can be
 * in flight concurrently (e.g. exporting several conversations one after
 * another without waiting for the previous one to finish).
 */
export interface ExportJob {
  /** Unique job identifier, stable across status updates. */
  id: string;
  /** Display label — the conversation title, or the export-all label. */
  label: string;
  /** Current lifecycle status. */
  status: ExportJobStatus;
}
