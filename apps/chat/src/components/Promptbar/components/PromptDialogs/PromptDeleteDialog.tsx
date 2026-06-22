import { useCallback, useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { PromptsActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/selectors';

import { PromptBarI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

import { PromptInfo } from '@epam/ai-dial-shared';

interface PromptDeleteDialogProps {
  deletingPromptId: string;
}

const view = withRenderWhenEntities<PromptDeleteDialogProps>({
  deletingPromptId: PromptsSelectors.selectDeletingPromptId,
})(({ deletingPromptId }: PromptDeleteDialogProps) => {
  const { t } = useTranslation(Translation.PromptBar);
  const dispatch = useAppDispatch();

  const deletingPrompt = useAppSelector((state) =>
    PromptsSelectors.selectPrompt(state, deletingPromptId),
  ) as PromptInfo;
  const isSelectMode = useAppSelector(PromptsSelectors.selectIsSelectMode);

  const dialogProps = useMemo(() => {
    if (!deletingPrompt) {
      return null;
    }

    return {
      heading: t(PromptBarI18nKeys.ConfirmDeletingPrompt),
      description: `${t(PromptBarI18nKeys.ConfirmDeletingPromptCaption)}${
        deletingPrompt.isShared ? t(PromptBarI18nKeys.DeletingWillStop) : ''
      }`,
      confirmLabel: t(PromptBarI18nKeys.Delete),
    };
  }, [deletingPrompt, t]);

  const handleConfirmDelete = useCallback(
    (isConfirmed: boolean) => {
      if (isConfirmed && deletingPrompt) {
        dispatch(PromptsActions.deletePrompt({ prompt: deletingPrompt }));
        dispatch(PromptsActions.selectPrompt({ promptId: undefined }));
      }

      dispatch(PromptsActions.setDeletingPromptId());
    },
    [deletingPrompt, dispatch],
  );

  useEffect(() => {
    if (isSelectMode) {
      dispatch(PromptsActions.setDeletingPromptId());
    }
  }, [dispatch, isSelectMode]);

  if (!dialogProps) {
    return null;
  }

  return (
    <ConfirmDialog
      isOpen
      heading={dialogProps.heading}
      description={dialogProps.description}
      confirmLabel={dialogProps.confirmLabel}
      cancelLabel={t(PromptBarI18nKeys.Cancel)}
      onClose={handleConfirmDelete}
    />
  );
});

export const PromptDeleteDialog = view;
