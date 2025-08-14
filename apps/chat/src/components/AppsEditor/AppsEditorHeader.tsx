import { useCallback, useMemo } from 'react';

import { useRouter } from 'next/router';

import { useBeforeRedirect } from '@/src/hooks/useBeforeRedirect';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
  ConversationsActions,
  PublicationActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ApplicationSelectors, ModelsSelectors } from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { EditorHeader } from '@/src/components/Header/EditorHeader';

enum TabKeys {
  GENERAL = 'general',
  SETTINGS = 'settings',
}

const myWorkspaceHref = {
  pathname: Routes.Marketplace,
  query: { tab: MarketplaceTabs.MY_WORKSPACE },
};

const tabKeysInfo = {
  [TabKeys.GENERAL]: {
    route: Routes.AppsEditorGeneralInfo,
    label: 'General info',
  },
  [TabKeys.SETTINGS]: {
    route: Routes.AppsEditorSettings,
    label: 'App settings',
  },
};

const anyRouteExceptAppEditorRegex = /^(?!\/apps-editor(?:\/|$)).*/;

interface AppsEditorHeaderProps {
  applicationTypeDisplayName: string;
  isEditApplication?: boolean;
  hasCustomEditor?: boolean;
}

export const AppsEditorHeader = ({
  applicationTypeDisplayName,
  isEditApplication,
  hasCustomEditor,
}: AppsEditorHeaderProps) => {
  const {
    query: { id = '', slug = '', add, publicationUrl },
    pathname,
    push,
  } = useRouter();
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Chat);

  const hasUnsavedChanges = useAppSelector(
    ApplicationSelectors.selectHasUnsavedChanges,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const returnConversationIds = useAppSelector(
    ApplicationSelectors.selectReturnConversationIds,
  );
  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );

  const agent = id ? modelsMap[id.toString()] : undefined;
  const activeTab =
    pathname === Routes.AppsEditorGeneralInfo
      ? TabKeys.GENERAL
      : TabKeys.SETTINGS;

  const tabs = useMemo(
    () => [
      {
        key: TabKeys.GENERAL,
        label: t(tabKeysInfo[TabKeys.GENERAL].label),
        disabled: false,
      },
      {
        key: TabKeys.SETTINGS,
        label: t(tabKeysInfo[TabKeys.SETTINGS].label),
        disabled: !id,
      },
    ],
    [t, id],
  );

  const title = `${t(isEditApplication && !add ? 'Edit' : 'Add')} ${applicationTypeDisplayName}`;

  const handleTabClick = useCallback(
    (tab: { key: TabKeys; disabled: boolean }) => {
      if (tab.disabled) return;
      if (hasUnsavedChanges) {
        dispatch(ApplicationActions.setShouldSaveApplication(true));
        dispatch(ApplicationActions.setHasUnsavedChanges(false));
      }
      push({
        pathname: tabKeysInfo[tab.key].route,
        query: { id, slug, add, publicationUrl },
      });
    },
    [add, dispatch, hasUnsavedChanges, id, publicationUrl, push, slug],
  );

  const handleSaveAndRedirect = useCallback(() => {
    if (
      !shouldSaveApplication &&
      isEditApplication &&
      !hasCustomEditor &&
      !isEntityIdPublic({ id: agent?.id as string })
    ) {
      dispatch(ApplicationActions.setShouldSaveApplication(true));
      dispatch(ApplicationActions.setExitAfterSave(true));
    } else {
      void push(myWorkspaceHref);
    }
  }, [
    agent?.id,
    dispatch,
    hasCustomEditor,
    isEditApplication,
    push,
    shouldSaveApplication,
  ]);

  const handleCustomViewerExit = useCallback(() => {
    if (hasCustomEditor) {
      dispatch(
        ApplicationTypesSchemasActions.resetDetailedApplicationTypeSchema(),
      );

      if (publicationUrl) {
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: [],
          }),
        );
        dispatch(PublicationActions.setIsApplicationReview(true));
      } else if (returnConversationIds?.length) {
        dispatch(
          ConversationsActions.selectConversations({
            conversationIds: returnConversationIds,
          }),
        );
        dispatch(ApplicationActions.setReturnConversationIds(undefined));
      } else {
        dispatch(
          ConversationsActions.createNewConversations({
            names: [DEFAULT_CONVERSATION_NAME],
          }),
        );
      }
    }
  }, [dispatch, hasCustomEditor, publicationUrl, returnConversationIds]);

  const getMobileLabelText = useCallback(
    (tabKey: TabKeys) => {
      const capitalizedAppType =
        applicationTypeDisplayName.charAt(0).toUpperCase() +
        applicationTypeDisplayName.slice(1);
      let labelText = tabKeysInfo[tabKey].label.toUpperCase();
      if (tabKey === TabKeys.SETTINGS) {
        labelText = labelText.replace(/^app\s+/i, '');
      }

      return `${capitalizedAppType} ${labelText}`;
    },
    [applicationTypeDisplayName],
  );

  const saveLabel =
    isEditApplication &&
    !hasCustomEditor &&
    !isEntityIdPublic({ id: agent?.id as string })
      ? 'Save and exit'
      : 'Exit';

  useBeforeRedirect(handleCustomViewerExit, anyRouteExceptAppEditorRegex);

  return (
    <EditorHeader
      tabs={tabs}
      activeTab={activeTab}
      isEditing={isEditApplication}
      onTabClick={handleTabClick}
      getMobileTabLabel={getMobileLabelText}
      title={title}
      saveLabel={saveLabel}
      onSave={handleSaveAndRedirect}
    />
  );
};
