import { useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { isEntityNameOnSameLevelUnique } from '@/src/utils/app/common';
import { regenerateConversationId } from '@/src/utils/app/conversation';
import { getParentAndCurrentFolderIdsById } from '@/src/utils/app/folders';

import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors, UISelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { PINNED_CONVERSATIONS_SECTION_NAME } from '@/src/constants/sections';

import { MoveToDialog } from '@/src/components/Common/MoveToDialog';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

import { ConversationInfo } from '@epam/ai-dial-shared';

interface ConversationMoveToDialogProps {
  moveToConversationId: string;
}

const view = withRenderWhenEntities<ConversationMoveToDialogProps>({
  moveToConversationId: ConversationsSelectors.selectMoveToConversationId,
})(({ moveToConversationId }: ConversationMoveToDialogProps) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const moveToConversation = useAppSelector((state) =>
    ConversationsSelectors.selectConversationById(state, moveToConversationId),
  ) as ConversationInfo;
  const allConversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const collapsedSectionsSelector = useMemo(
    () => UISelectors.selectCollapsedSections(FeatureType.Chat),
    [],
  );
  const collapsedSections = useAppSelector(collapsedSectionsSelector);

  const handleMoveToFolder = useCallback(
    (folderId: string) => {
      if (
        !isEntityNameOnSameLevelUnique(
          moveToConversation.name,
          { ...moveToConversation, folderId },
          allConversations,
        )
      ) {
        dispatch(
          UIActions.showErrorToast({
            message: t(ChatI18nKeys.ConversationNameExistsInThisFolder, {
              ns: Translation.Chat,
              name: moveToConversation.name,
            }),
          }),
        );

        return;
      }

      dispatch(
        UIActions.setCollapsedSections({
          featureType: FeatureType.Chat,
          collapsedSections: collapsedSections.filter(
            (section) => section !== PINNED_CONVERSATIONS_SECTION_NAME,
          ),
        }),
      );
      dispatch(
        ConversationsActions.updateConversation({
          id: moveToConversation.id,
          values: { folderId },
        }),
      );
      dispatch(
        UIActions.setOpenedFoldersIds({
          openedFolderIds: getParentAndCurrentFolderIdsById(folderId),
          featureType: FeatureType.Chat,
        }),
      );
      dispatch(
        UIActions.setScrollToEntityId(
          regenerateConversationId({
            ...moveToConversation,
            folderId,
          }).id,
        ),
      );
      dispatch(ConversationsActions.setMoveToConversationId());
    },
    [allConversations, collapsedSections, moveToConversation, dispatch, t],
  );

  const handleClose = useCallback(() => {
    dispatch(ConversationsActions.setMoveToConversationId());
  }, [dispatch]);

  return (
    <MoveToDialog
      entity={moveToConversation}
      featureType={FeatureType.Chat}
      onClose={handleClose}
      onSelect={handleMoveToFolder}
    />
  );
});

export const ConversationMoveToDialog = view;
