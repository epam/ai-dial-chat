import type { FileUploadResponseDto } from '@epam/chat-api-client';
import {
  UnauthorizedError,
  getCsrfToken,
  notifyUnauthorized,
  setCsrfToken,
} from './base';

const UPLOAD_URL = '/api/v1/files';

export type UploadMode = 'overwrite' | 'create-only';

export type UploadFileWithProgressOptions = {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
  uploadMode?: UploadMode;
};

export const uploadFileWithProgress = (
  bucket: string,
  path: string,
  file: File,
  { signal, onProgress, uploadMode }: UploadFileWithProgressOptions,
): Promise<FileUploadResponseDto> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', UPLOAD_URL);
    xhr.withCredentials = true;

    const csrfToken = getCsrfToken();
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
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    });

    xhr.addEventListener('load', () => {
      const rotated = xhr.getResponseHeader('x-csrf-token');
      if (rotated) {
        setCsrfToken(rotated);
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
        notifyUnauthorized(UPLOAD_URL);
        reject(new UnauthorizedError(UPLOAD_URL));
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
