/**
 * Returns a `Response` that streams the same bytes as `response` and calls
 * `onBytes` with the running total of bytes read; headers and status are kept,
 * so `Content-Disposition` naming still works. A response without a body is
 * returned unchanged.
 */
export const withDownloadProgress = (
  response: Response,
  onBytes: (received: number) => void,
): Response => {
  if (!response.body) return response;

  let received = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      onBytes(received);
      controller.enqueue(chunk);
    },
  });

  return new Response(response.body.pipeThrough(counter), {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
};

/** The response's `Content-Length` as a positive byte count, or `undefined` when it is absent or not a positive number. */
export const getContentLength = (response: Response): number | undefined => {
  const value = Number(response.headers.get('content-length'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
};

/**
 * Percent of `total` received, or `undefined` when the total is unknown. An
 * estimated total (an archive) is capped at 99 so the row never reads 100
 * before the stream actually ends.
 */
export const getDownloadPercent = (
  received: number,
  total: number | undefined,
  isEstimate: boolean,
): number | undefined => {
  if (total == null) return undefined;
  const percent = Math.round((received / total) * 100);
  return Math.min(isEstimate ? 99 : 100, percent);
};

/** An error for a non-OK download `Response` that keeps it, so `getApiErrorDetails` reads its status and body. */
export const createDownloadResponseError = (response: Response): Error =>
  Object.assign(new Error(`Download failed with status ${response.status}`), {
    response,
  });

/** The size an item contributes to an archive estimate: a file with a known size. */
interface ArchiveSizedItem {
  /** Whether the item is a file or a folder. */
  isFolder: boolean;
  /** The file's size in bytes, when known. */
  contentLength?: number;
}

/**
 * Estimated archive size: the sum of the selected files' sizes, or `undefined`
 * when any item is a folder (its contents are not known up front) or has no
 * size. The zip is stored uncompressed, so the sum undershoots only by the
 * per-entry headers.
 */
export const estimateArchiveSize = (
  items: ArchiveSizedItem[],
): number | undefined => {
  let total = 0;
  for (const item of items) {
    if (item.isFolder || item.contentLength == null) return undefined;
    total += item.contentLength;
  }
  return total > 0 ? total : undefined;
};
