import {
  DownloadDestinationType,
  type DownloadDestination,
} from './download-destination';

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

/**
 * Resolves where a download should be written: the browser's native "Save
 * As" picker when available (`window.showSaveFilePicker`), otherwise a
 * plain blob download. Returns `Cancelled` if the user dismisses the picker.
 */
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
