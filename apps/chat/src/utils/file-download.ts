import { triggerBlobDownload } from '@epam/ai-dial-chat-shared';

const extractFilename = (contentDisposition: string | null): string | null => {
  if (!contentDisposition) return null;
  const match = /filename[^;=\n]*=(?:(\\?['"])(.*?)\1|([^;\n]*))/i.exec(
    contentDisposition,
  );
  const raw = match?.[2] ?? match?.[3];
  if (!raw) return null;
  return raw.replace(/[/\\]/g, '').trim() || null;
};

interface FileSaveHandle {
  createWritable: () => Promise<WritableStream<Uint8Array>>;
}

type ShowSaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<FileSaveHandle>;

export enum DownloadDestinationType {
  Blob = 'blob',
  Stream = 'stream',
  Cancelled = 'cancelled',
}

export type DownloadDestination =
  | { type: DownloadDestinationType.Blob }
  | {
      type: DownloadDestinationType.Stream;
      writable: WritableStream<Uint8Array>;
    }
  | { type: DownloadDestinationType.Cancelled };

export const prepareDownloadDestination = async (
  filename: string,
  mimeType = 'application/octet-stream',
): Promise<DownloadDestination> => {
  const showSaveFilePicker = (
    window as Window & { showSaveFilePicker?: ShowSaveFilePicker }
  ).showSaveFilePicker;

  if (showSaveFilePicker == null) {
    return { type: DownloadDestinationType.Blob };
  }

  try {
    const extensionIndex = filename.lastIndexOf('.');
    const extension =
      extensionIndex >= 0 ? filename.slice(extensionIndex) : undefined;
    const handle = await showSaveFilePicker.call(window, {
      suggestedName: filename,
      types: [
        {
          description: mimeType,
          accept: {
            [mimeType]: extension != null ? [extension] : [],
          },
        },
      ],
    });
    return {
      type: DownloadDestinationType.Stream,
      writable: await handle.createWritable(),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { type: DownloadDestinationType.Cancelled };
    }
    throw error;
  }
};

export const triggerBrowserDownload = async (
  response: Response,
  fallbackName: string,
  destination: DownloadDestination = {
    type: DownloadDestinationType.Blob,
  },
): Promise<void> => {
  if (destination.type === DownloadDestinationType.Cancelled) return;

  if (destination.type === DownloadDestinationType.Stream) {
    if (response.body == null) {
      await destination.writable.abort('Response has no readable stream');
      throw new Error('Response has no readable stream');
    }
    await response.body.pipeTo(destination.writable);
    return;
  }

  const filename =
    extractFilename(response.headers.get('Content-Disposition')) ??
    fallbackName;
  const blob = await response.blob();
  triggerBlobDownload(blob, filename);
};
