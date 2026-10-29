import type { ProjectConversationsPanelLabels } from '@epam/ai-dial-projects';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useDeleteConfirmationLabels } from '../useDeleteConfirmationLabels';
import { useProjectConversationListLabels } from './useProjectConversationListLabels';

/** Resolves every string the `ProjectConversationsPanel` lib component renders, memoised on `t`. */
export const useProjectConversationsPanelLabels =
  (): ProjectConversationsPanelLabels => {
    const { t } = useTranslation();
    const list = useProjectConversationListLabels();
    const deleteDialog = useDeleteConfirmationLabels();

    return useMemo<ProjectConversationsPanelLabels>(
      () => ({
        list,
        renameTitle: t(ProjectsI18nKeys.ChatsRenameTitle),
        renameInputLabel: t(ProjectsI18nKeys.ChatsRenameInputLabel),
        renameEmptyError: t(ProjectsI18nKeys.ChatsRenameEmpty),
        renameSaveLabel: t(ButtonsI18nKeys.Save),
        deleteTitle: (title) =>
          t(ProjectsI18nKeys.ChatsDeleteConfirmTitle, { title }),
        deleteDescription: t(ProjectsI18nKeys.ChatsDeleteConfirmDescription),
        deleteDialog,
      }),
      [deleteDialog, list, t],
    );
  };
