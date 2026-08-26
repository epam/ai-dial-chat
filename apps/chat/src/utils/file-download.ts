import {
  DownloadDestinationType,
  type DownloadDestination,
} from '@epam/ai-dial-chat-hooks';
import { triggerBlobDownload } from '@epam/ai-dial-chat-shared';

export { prepareDownloadDestination } from '@epam/ai-dial-chat-hooks';

const extractFilename = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) return null;
  const match = /filename[^;=\n]*=(?:(\\?['"])(.*?)\1|([^;\n]*))/i.exec(
    contentDisposition,
  );
  const raw = match?.[2] ?? match?.[3];
  if (!raw) return null;
  return raw.replace(/[/\\]/g, '').trim() || null;
};

/**
 * Writes `response` to disk and returns the file name it was saved under — the
 * `Content-Disposition` name when the response carries one, otherwise
 * `fallbackName`. Callers report the returned name so a confirmation names what
 * is actually on disk rather than what was requested.
 */
export const triggerBrowserDownload = async (
  response: Response,
  fallbackName: string,
  destination: DownloadDestination = {
    type: DownloadDestinationType.Blob,
  },
): Promise<string> => {
  if (destination.type === DownloadDestinationType.Cancelled) {
    return fallbackName;
  }

  if (destination.type === DownloadDestinationType.Stream) {
    if (response.body == null) {
      await destination.writable.abort('Response has no readable stream');
      throw new Error('Response has no readable stream');
    }
    await response.body.pipeTo(destination.writable);
    /* The picker was opened with this name, so it is what the user saved. */
    return fallbackName;
  }

  const filename =
    extractFilename(response.headers.get('Content-Disposition')) ??
    fallbackName;
  const blob = await response.blob();
  triggerBlobDownload(blob, filename);
  return filename;
};
