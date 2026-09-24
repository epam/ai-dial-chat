import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** Supplies the same translated refinement copy to both authoring forms. */
export const useTextRefinementLabels = () => {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      refineWithAiLabel: t('textRefinement.action'),
      refineUndoLabel: t('textRefinement.undo'),
      refineErrorLabel: t('textRefinement.error'),
      refinePendingAriaLabel: t('textRefinement.pending'),
      refineSuccessAriaLabel: t('textRefinement.success'),
      refineUndoAriaLabel: t('textRefinement.restored'),
      refineUnchangedAriaLabel: t('textRefinement.unchanged'),
    }),
    [t],
  );
};
