import type { DialFilesApi } from '@epam/ai-dial-chat-hooks';
import {
  copyFiles,
  createFolder,
  deleteFiles,
  discardShared,
  downloadArchive,
  downloadFile,
  getFileMetadata,
  listFiles,
  listPublicFiles,
  listSharedByMe,
  listSharedFiles,
  moveFiles,
  renameFiles,
  revokeAccess,
  uploadArchive,
  uploadFile,
} from './files.api';

/**
 * Thin `DialFilesApi` implementation delegating to the existing, unchanged
 * `server-api/files.api.ts` exports. This is the only seam through which
 * `@epam/ai-dial-chat-hooks`'s file-manager hooks reach the generated client —
 * the hooks never import or configure `files.api.ts` themselves.
 */
export const dialFilesApiAdapter: DialFilesApi = {
  listFiles,
  listPublicFiles,
  listSharedFiles,
  listSharedByMe,
  getFileMetadata,
  uploadFile,
  uploadArchive,
  createFolder,
  deleteFiles,
  renameFiles,
  copyFiles,
  moveFiles,
  downloadFile,
  downloadArchive,
  revokeAccess,
  discardShared,
};
