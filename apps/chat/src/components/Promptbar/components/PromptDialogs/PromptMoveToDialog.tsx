import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getParentAndCurrentFolderIdsById } from '@/src/utils/app/folders';
import { regeneratePromptId } from '@/src/utils/app/prompts';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { PromptsActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.selectors';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import { PINNED_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import { MoveToDialog } from '@/src/components/Common/MoveToDialog';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';

import { ShareEntity } from '@epam/ai-dial-shared';

const PromptMoveToDialogComponent = () => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Prompt),
    [],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);
  const moveToPrompt = useAppSelector(
    PromptsSelectors.selectMoveToPrompt,
  ) as ShareEntity;
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);

  const handleMoveToFolder = useCallback(
    (folderId: string) => {
      if (
        !isEntityNameOnSameLevelUnique(
          moveToPrompt.name,
          { ...moveToPrompt, folderId },
          allPrompts,
        )
      ) {
        dispatch(
          UIActions.showErrorToast(
            t('Prompt with name "{{name}}" already exists in this folder.', {
              ns: Translation.PromptBar,
              name: moveToPrompt.name,
            }),
          ),
        );

        return;
      }

      dispatch(
        UIActions.setCollapsedSections({
          featureType: FeatureType.Prompt,
          collapsedSections: collapsedSections.filter(
            (section) => section !== PINNED_PROMPTS_SECTION_NAME,
          ),
        }),
      );

      dispatch(
        PromptsActions.updatePrompt({
          id: moveToPrompt.id,
          values: { folderId },
        }),
      );

      const regeneratedPromptId = regeneratePromptId({
        ...moveToPrompt,
        folderId,
      }).id;

      dispatch(
        UIActions.setOpenedFoldersIds({
          openedFolderIds: getParentAndCurrentFolderIdsById(folderId),
          featureType: FeatureType.Prompt,
        }),
      );
      dispatch(UIActions.setScrollToEntityId(regeneratedPromptId));
      dispatch(PromptsActions.setMoveToPrompt());
    },

    [allPrompts, collapsedSections, dispatch, moveToPrompt, t],
  );

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setMoveToPrompt());
  }, [dispatch]);

  return (
    <MoveToDialog
      entity={moveToPrompt}
      featureType={FeatureType.Prompt}
      onClose={handleClose}
      onSelect={handleMoveToFolder}
    />
  );
};

export const PromptMoveToDialog = withRenderWhen(
  PromptsSelectors.selectMoveToPrompt,
)(PromptMoveToDialogComponent);
