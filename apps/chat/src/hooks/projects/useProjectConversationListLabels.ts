import type { ProjectConversationListLabels } from '@epam/ai-dial-projects';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';

/**
 * Resolves every string the `ProjectConversationList` lib component renders,
 * memoised on `t` so the lib receives a stable labels object between renders.
 */
export const useProjectConversationListLabels =
  (): ProjectConversationListLabels => {
    const { t } = useTranslation();

    return useMemo<ProjectConversationListLabels>(
      () => ({
        title: t(ProjectsI18nKeys.ChatsTitle),
        openLabel: (title, authorName) =>
          authorName
            ? t(ProjectsI18nKeys.ChatsOpenLabel, { title, author: authorName })
            : t(ProjectsI18nKeys.ChatsOpenLabelNoAuthor, { title }),
        moreActionsLabel: (title) =>
          t(ProjectsI18nKeys.ChatsMoreActions, { title }),
        renameLabel: t(ButtonsI18nKeys.Rename),
        deleteLabel: t(ButtonsI18nKeys.Delete),
        loadingLabel: t(ProjectsI18nKeys.ChatsLoading),
        errorLabel: t(ProjectsI18nKeys.ChatsError),
        retryLabel: t(ButtonsI18nKeys.Retry),
        emptyTitle: t(ProjectsI18nKeys.ChatsEmpty),
        emptyDescription: t(ProjectsI18nKeys.ChatsEmptyDescription),
      }),
      [t],
    );
  };
