import type { FileUploadResponseDto } from '@epam/ai-dial-chat-api-client';
import type {
  UploadFileWithProgressFn,
  UploadFileWithProgressOptions,
} from './create-files-api';

/** Host capabilities {@link createUploadFileWithProgress} needs to perform an XHR upload. */
/*
 * A failed upload keeps its response, shaped like a fetch `Response`, so
 * `getApiErrorDetails` reads its status and error body exactly as it does
 * for a generated-client error.
 */
class UploadRequestError extends Error {
  readonly response: {
    status: number;
    json: () => Promise<unknown>;
    headers: { get: (name: string) => string | null };
  };

  constructor(xhr: XMLHttpRequest) {
    super(`Upload failed with status ${xhr.status}`);
    this.name = 'UploadRequestError';
    const { status, responseText } = xhr;
    this.response = {
      status,
      json: async () => JSON.parse(responseText) as unknown,
      headers: { get: (name) => xhr.getResponseHeader(name) },
    };
  }
}

/** Rejection for an upload that got no response at all (the XHR `error` event). */
export class UploadNetworkError extends Error {
  constructor() {
    super('Upload failed');
    this.name = 'UploadNetworkError';
  }
}

/** How {@link createUploadFileWithProgress} encodes the upload request. */
export enum UploadBodyEncoding {
  /** `POST` with a `FormData` body carrying `file`, `bucket`, `path` and `uploadMode`. */
  Multipart = 'multipart',
  /**
   * `PUT` with the `File` itself as the body (`Content-Type:
   * application/octet-stream`) and `bucket`, `path`, `uploadMode` and
   * `contentType` in the query string, so the server can stream the body
   * without parsing it.
   */
  Raw = 'raw',
}

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
  /**
   * How the request carries the file and its fields; must match what the
   * endpoint at `uploadUrl` accepts. Defaults to {@link UploadBodyEncoding.Multipart}.
   */
  bodyEncoding?: UploadBodyEncoding;
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
  const {
    uploadUrl,
    bodyEncoding = UploadBodyEncoding.Multipart,
    xhrFactory = () => new XMLHttpRequest(),
  } = deps;

  return (
    bucket: string,
    path: string,
    file: File,
    { signal, onProgress, uploadMode }: UploadFileWithProgressOptions = {},
  ): Promise<FileUploadResponseDto> =>
    new Promise((resolve, reject) => {
      const xhr = xhrFactory();
      const isRaw = bodyEncoding === UploadBodyEncoding.Raw;
      const fields = new URLSearchParams({ bucket, path });
      if (uploadMode != null) {
        fields.append('uploadMode', uploadMode);
      }

      if (isRaw) {
        if (file.type !== '') {
          fields.append('contentType', file.type);
        }
        xhr.open('PUT', `${uploadUrl}?${fields.toString()}`);
        xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      } else {
        xhr.open('POST', uploadUrl);
      }
      xhr.withCredentials = true;

      const csrfToken = deps.getCsrfToken();
      if (csrfToken != null) {
        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
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

        reject(new UploadRequestError(xhr));
      });

      xhr.addEventListener('error', () => {
        reject(new UploadNetworkError());
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

      if (isRaw) {
        xhr.send(file);
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      fields.forEach((value, name) => formData.append(name, value));
      xhr.send(formData);
    });
};
