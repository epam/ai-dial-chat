import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { getParentAndCurrentFolderIdsById } from '@/src/utils/app/folders';
import { regeneratePromptId } from '@/src/utils/app/prompts';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { PromptsActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors, UISelectors } from '@/src/store/selectors';

import { PromptBarI18nKeys } from '@/src/constants/i18n';
import { PINNED_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import { MoveToDialog } from '@/src/components/Common/MoveToDialog';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

import { PromptInfo } from '@epam/ai-dial-shared';

interface PromptMoveToDialogProps {
  moveToPromptId: string;
}

const view = withRenderWhenEntities<PromptMoveToDialogProps>({
  moveToPromptId: PromptsSelectors.selectMoveToPromptId,
})(({ moveToPromptId }: PromptMoveToDialogProps) => {
  const { t } = useTranslation(Translation.PromptBar);

  const dispatch = useAppDispatch();

  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Prompt),
    [],
  );

  const collapsedSections = useAppSelector(collapsedSectionsSelector);
  const moveToPrompt = useAppSelector((state) =>
    PromptsSelectors.selectPrompt(state, moveToPromptId),
  ) as PromptInfo;

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
          UIActions.showErrorToast({
            message: t(PromptBarI18nKeys.ExistsInThisFolder, {
              ns: Translation.PromptBar,
              name: moveToPrompt.name,
            }),
          }),
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
      dispatch(PromptsActions.setMoveToPromptId());
    },

    [allPrompts, collapsedSections, dispatch, moveToPrompt, t],
  );

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setMoveToPromptId());
  }, [dispatch]);

  return (
    <MoveToDialog
      entity={moveToPrompt}
      featureType={FeatureType.Prompt}
      onClose={handleClose}
      onSelect={handleMoveToFolder}
    />
  );
});

export const PromptMoveToDialog = view;
