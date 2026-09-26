import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TextRefinementI18nKeys } from '../constants/translation-keys';

/** Supplies the same translated refinement copy to both authoring forms. */
export const useTextRefinementLabels = () => {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      refineWithAiLabel: t(TextRefinementI18nKeys.Action),
      refineUndoLabel: t(TextRefinementI18nKeys.Undo),
      refineErrorLabel: t(TextRefinementI18nKeys.Error),
      refinePendingAriaLabel: t(TextRefinementI18nKeys.Pending),
      refineSuccessAriaLabel: t(TextRefinementI18nKeys.Success),
      refineUndoAriaLabel: t(TextRefinementI18nKeys.Restored),
      refineUnchangedAriaLabel: t(TextRefinementI18nKeys.Unchanged),
    }),
    [t],
  );
};
