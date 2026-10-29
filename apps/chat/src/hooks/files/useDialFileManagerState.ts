import {
  useFileAttachmentModalState,
  type UseFileAttachmentModalStateResult,
} from '@epam/ai-dial-chat-hooks/file-manager';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
/** Parent attachment modal result. */
export type UseDialFileManagerStateResult = UseFileAttachmentModalStateResult;
/** Supplies the host bucket and image preview resolver to pending attachment state. */
export const useDialFileManagerState = (
  bucket: string,
): UseDialFileManagerStateResult =>
  useFileAttachmentModalState({
    bucket,
    resolvePreviewUrl: resolveCatalogIconUrl,
  });
