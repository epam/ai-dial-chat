import type { DeleteConfirmationDialogLabels } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
} from '../constants/translation-keys';

/** Supplies the translated copy every `DeleteConfirmationDialog` shares. */
export const useDeleteConfirmationLabels =
  (): DeleteConfirmationDialogLabels => {
    const { t } = useTranslation();
    return useMemo(
      () => ({
        confirm: t(ButtonsI18nKeys.Delete),
        cancel: t(ButtonsI18nKeys.Cancel),
        deleting: t(BasicI18nKeys.DeletingStatus),
        cannotBeUndone: t(BasicI18nKeys.ConsequenceCannotBeUndone),
        itemCount: (count) =>
          t(DialFileManagerI18nKeys.DeleteConfirmItemCount, { count }),
        moreItems: (count) =>
          t(DialFileManagerI18nKeys.DeleteConfirmMoreItems, { count }),
      }),
      [t],
    );
  };
