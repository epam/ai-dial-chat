import type { FileUploadResponseDto } from '@epam/ai-dial-chat-api-client';
import type {
  UploadFileWithProgressFn,
  UploadFileWithProgressOptions,
} from './create-files-api';

/** Host capabilities {@link createUploadFileWithProgress} needs to perform an XHR upload. */
export interface CreateUploadFileWithProgressDeps {
  /** Returns the currently held CSRF token, or `null` when none is set. */
  getCsrfToken: () => string | null;
  /** Stores a CSRF token captured from the upload response header. */
  setCsrfToken: (token: string | null) => void;
  /** Notifies the host that the upload request was unauthorized. */
  notifyUnauthorized: (url: string) => void;
  /** Constructs the error thrown to signal an unauthorized upload. */
  createUnauthorizedError: (url: string) => Error;
  /** The upload endpoint's URL. */
  uploadUrl: string;
  /** Builds the `XMLHttpRequest` instance to upload through. Defaults to `() => new XMLHttpRequest()`. */
  xhrFactory?: () => XMLHttpRequest;
}

/**
 * Builds a progress-reporting file-upload function backed by
 * `XMLHttpRequest` (needed because the `fetch`-based generated client has no
 * upload-progress event), reporting progress, honoring an `AbortSignal`,
 * attaching/rotating a CSRF token, and reporting an unauthorized response.
 */
export const createUploadFileWithProgress = (
  deps: CreateUploadFileWithProgressDeps,
): UploadFileWithProgressFn => {
  const { uploadUrl, xhrFactory = () => new XMLHttpRequest() } = deps;

  return (
    bucket: string,
    path: string,
    file: File,
    { signal, onProgress, uploadMode }: UploadFileWithProgressOptions = {},
  ): Promise<FileUploadResponseDto> =>
    new Promise((resolve, reject) => {
      const xhr = xhrFactory();
      xhr.open('POST', uploadUrl);
      xhr.withCredentials = true;

      const csrfToken = deps.getCsrfToken();
      if (csrfToken != null) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('path', path);
      if (uploadMode != null) {
        formData.append('uploadMode', uploadMode);
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (!onProgress || !event.lengthComputable || event.total <= 0) {
          return;
        }
        onProgress(
          Math.min(100, Math.round((event.loaded / event.total) * 100)),
        );
      });

      xhr.addEventListener('load', () => {
        const rotated = xhr.getResponseHeader('x-csrf-token');
        if (rotated) {
          deps.setCsrfToken(rotated);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText) as FileUploadResponseDto);
          } catch {
            reject(new Error('Upload response was not valid JSON'));
          }
          return;
        }

        if (xhr.status === 401) {
          deps.notifyUnauthorized(uploadUrl);
          reject(deps.createUnauthorizedError(uploadUrl));
          return;
        }

        reject(new Error(`Upload failed with status ${xhr.status}`));
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        reject(new DOMException('Upload aborted', 'AbortError'));
      });

      if (signal != null) {
        if (signal.aborted) {
          xhr.abort();
          return;
        }
        signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      xhr.send(formData);
    });
};
