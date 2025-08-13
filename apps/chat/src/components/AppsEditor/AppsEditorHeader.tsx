import {
  IconCircleCheck,
  IconCircleDot,
  IconLogout,
} from '@tabler/icons-react';
import { useCallback, useMemo } from 'react';

import Link from 'next/link';
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

const getTabIcon = (
  tab: TabKeys,
  activeTab: TabKeys,
  isEditing?: boolean,
  isDisabled?: boolean,
) => {
  return tab !== activeTab && isEditing ? (
    <IconCircleCheck
      className="text-accent-primary"
      data-qa="selected-step-icon"
      width={24}
      height={24}
    />
  ) : (
    <IconCircleDot
      className={isDisabled ? 'text-secondary' : 'text-accent-primary'}
      data-qa="not-selected-step-icon"
      width={24}
      height={24}
    />
  );
};

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
        Icon: () => getTabIcon(TabKeys.GENERAL, activeTab, !!id, false),
      },
      {
        key: TabKeys.SETTINGS,
        label: t(tabKeysInfo[TabKeys.SETTINGS].label),
        disabled: !id,
        Icon: () => getTabIcon(TabKeys.SETTINGS, activeTab, !!id, !id),
      },
    ],
    [t, id, activeTab],
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
    if (!shouldSaveApplication) {
      dispatch(ApplicationActions.setShouldSaveApplication(true));
      dispatch(ApplicationActions.setExitAfterSave(true));
    }
  }, [dispatch, shouldSaveApplication]);

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

  useBeforeRedirect(handleCustomViewerExit, anyRouteExceptAppEditorRegex);

  return (
    <EditorHeader
      tabs={tabs}
      activeTab={activeTab}
      onTabClick={handleTabClick}
      getMobileTabLabel={getMobileLabelText}
      title={title}
      renderSaveButton={() =>
        isEditApplication &&
        !hasCustomEditor &&
        !isEntityIdPublic({ id: agent?.id as string }) ? (
          <button
            className="button flex items-center space-x-1 text-accent-primary max-xl:p-0 md:flex"
            onClick={handleSaveAndRedirect}
            data-qa="save-and-exit"
          >
            <IconLogout size={14} />
            <span>{t('Save and exit')}</span>
          </button>
        ) : (
          <Link
            className="flex items-center space-x-1 px-3 text-accent-primary"
            data-qa="exit-link"
            href={myWorkspaceHref}
          >
            <IconLogout size={14} />
            <span>{t('Exit')}</span>
          </Link>
        )
      }
    />
  );
};
