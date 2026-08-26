/**
 * Where a downloaded file's bytes should be written. Mirrors the host's own
 * "Save As" vs. blob-download vs. cancelled-picker outcomes without the lib
 * depending on the host's browser-API implementation.
 */
export enum DownloadDestinationType {
  Blob = 'blob',
  Stream = 'stream',
  Cancelled = 'cancelled',
}

/** Discriminated destination a host resolves for a download, passed back into `triggerDownload`. */
export type DownloadDestination =
  | { type: DownloadDestinationType.Blob }
  | {
      type: DownloadDestinationType.Stream;
      writable: WritableStream<Uint8Array>;
    }
  | { type: DownloadDestinationType.Cancelled };

/**
 * Host-injected seam for `useDialFileMutations.onDownloadFiles`, replacing a
 * direct import of the app's browser "Save As" / auto-download utilities —
 * that behavior is desktop/web-shell-specific, not file-manager domain logic.
 */
export interface DownloadDestinationHandlers {
  /** Resolves where a download with the given file name/MIME type should be written. */
  resolveDestination(
    filename: string,
    mimeType: string,
  ): Promise<DownloadDestination>;
  /** Writes `response` to `destination` and returns the name it was saved under. */
  triggerDownload(
    response: Response,
    fallbackName: string,
    destination: DownloadDestination,
  ): Promise<string>;
}
