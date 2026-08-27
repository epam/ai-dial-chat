import { createUploadFileWithProgress } from '@epam/ai-dial-chat-hooks';
import {
  UnauthorizedError,
  getCsrfToken,
  notifyUnauthorized,
  setCsrfToken,
} from './base';

const UPLOAD_URL = '/api/v1/files';

export const uploadFileWithProgress = createUploadFileWithProgress({
  getCsrfToken,
  setCsrfToken,
  notifyUnauthorized,
  createUnauthorizedError: (url) => new UnauthorizedError(url),
  uploadUrl: UPLOAD_URL,
});
