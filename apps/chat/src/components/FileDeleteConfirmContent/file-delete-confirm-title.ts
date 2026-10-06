import {
  DialFileNodeType,
  type DialFile,
} from '@epam/ai-dial-react-file-manager';
import type { TFunction } from 'i18next';
import { DialFileManagerI18nKeys } from '../../constants/translation-keys';

/**
 * Title of the file manager's delete confirmation: "Delete folder" or
 * "Delete file" for one item, by its `nodeType`, and "Delete items" for
 * several.
 */
export const getFileDeleteConfirmTitle = (
  t: TFunction,
  items: DialFile[],
): string => {
  if (items.length !== 1) {
    return t(DialFileManagerI18nKeys.DeleteConfirmTitleMultiple);
  }

  return items[0].nodeType === DialFileNodeType.FOLDER
    ? t(DialFileManagerI18nKeys.DeleteConfirmTitleFolder)
    : t(DialFileManagerI18nKeys.DeleteConfirmTitleFile);
};
