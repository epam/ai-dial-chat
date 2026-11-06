import type { UnpublishConfirmationDialogLabels } from '@epam/ai-dial-publish-panel';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';

/** The feature-specific translation keys of one unpublish surface. */
interface UnpublishConfirmationKeys {
  /** Dialog title. */
  title: string;
  /** Single-folder message; interpolates `name` and `folder`. */
  confirmMessage: string;
  /** Pick-a-folder message; interpolates `name`. */
  selectFolderMessage: string;
  /** Accessible name of the folder radio group. */
  folderGroupAriaLabel: string;
  /** Status announced while the request runs. */
  requestingStatus: string;
}

/** Translated `UnpublishConfirmationDialog` labels: the surface's own copy plus the shared buttons and root folder name. */
export const useUnpublishConfirmationLabels = ({
  title,
  confirmMessage,
  selectFolderMessage,
  folderGroupAriaLabel,
  requestingStatus,
}: UnpublishConfirmationKeys): UnpublishConfirmationDialogLabels => {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      title: t(title),
      confirmLabel: t(ButtonsI18nKeys.Unpublish),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      rootFolderLabel: t(BasicI18nKeys.Organization),
      folderGroupAriaLabel: t(folderGroupAriaLabel),
      loadingStatusLabel: t(requestingStatus),
      confirmMessage: (name: string, folder: string) =>
        t(confirmMessage, { name, folder }),
      selectFolderMessage: (name: string) => t(selectFolderMessage, { name }),
    }),
    [
      confirmMessage,
      folderGroupAriaLabel,
      requestingStatus,
      selectFolderMessage,
      t,
      title,
    ],
  );
};
