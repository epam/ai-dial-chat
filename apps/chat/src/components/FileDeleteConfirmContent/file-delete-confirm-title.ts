import {
  FileSelectionKind,
  getFileSelectionKind,
} from '@epam/ai-dial-chat-hooks';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import type { TFunction } from 'i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';

const DELETE_TITLE_KEYS: Record<FileSelectionKind, DialFileManagerI18nKeys> = {
  [FileSelectionKind.File]: DialFileManagerI18nKeys.DeleteConfirmTitleFile,
  [FileSelectionKind.Folder]: DialFileManagerI18nKeys.DeleteConfirmTitleFolder,
  [FileSelectionKind.Multiple]:
    DialFileManagerI18nKeys.DeleteConfirmTitleMultiple,
};

/**
 * Title of the file manager's delete confirmation: "Delete folder" or
 * "Delete file" for one item, by its `nodeType`, and "Delete items" for
 * several.
 */
export const getFileDeleteConfirmTitle = (
  t: TFunction,
  items: DialFile[],
): string => t(DELETE_TITLE_KEYS[getFileSelectionKind(items)]);
