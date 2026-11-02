import {
  UploadBodyEncoding,
  createUploadFileWithProgress,
} from '@epam/ai-dial-chat-hooks';
import {
  UnauthorizedError,
  getCsrfToken,
  notifyUnauthorized,
  setCsrfToken,
} from './base';

/* Streamed raw-body upload: the BFF pipes the body to DIAL Core without staging it. */
const UPLOAD_URL = '/api/v1/files/content';

export const uploadFileWithProgress = createUploadFileWithProgress({
  getCsrfToken,
  setCsrfToken,
  notifyUnauthorized,
  createUnauthorizedError: (url) => new UnauthorizedError(url),
  uploadUrl: UPLOAD_URL,
  bodyEncoding: UploadBodyEncoding.Raw,
});
