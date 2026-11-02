import {
  useFileAttachmentModalState,
  type UseFileAttachmentModalStateResult,
} from '@epam/ai-dial-chat-hooks/file-manager';
import { resolveCatalogIconUrl } from '../../utils/icon-path';

/** Supplies the host bucket and image preview resolver to pending attachment state. */
export const useDialFileManagerState = (
  bucket: string,
): UseFileAttachmentModalStateResult =>
  useFileAttachmentModalState({
    bucket,
    resolvePreviewUrl: resolveCatalogIconUrl,
  });
