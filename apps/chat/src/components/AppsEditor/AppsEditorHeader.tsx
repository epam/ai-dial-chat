import {
  IconChevronDown,
  IconCircleCheck,
  IconCircleDot,
  IconLogout,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useBeforeRedirect } from '@/src/hooks/useBeforeRedirect';
import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdPublic } from '@/src/utils/app/publications';

import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationTypesSchemasActions,
  ConversationsActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ModelsSelectors,
  SettingsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { Logo } from '@/src/components/Header/Logo';
import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { UrlObject } from 'url';

enum TabKeys {
  GENERAL = 'general',
  SETTINGS = 'settings',
}

const myWorkspaceHref = {
  pathname: Routes.Marketplace,
  query: { tab: MarketplaceTabs.MY_WORKSPACE },
};

const anyRouteExceptAppEditorRegex = /^(?!\/apps-editor(?:\/|$)).*/;

interface AppsEditorHeaderProps {
  applicationTypeDisplayName: string;
  isEditApplication?: boolean;
  hasCustomEditor?: boolean;
}

export const AppsEditorHeader: React.FC<AppsEditorHeaderProps> = ({
  applicationTypeDisplayName,
  isEditApplication,
  hasCustomEditor,
}) => {
  const dispatch = useAppDispatch();
  const {
    query: { id = '', slug = '', add, publicationUrl },
    pathname,
    push,
  } = useRouter();
  const { t } = useTranslation(Translation.Chat);

  const [menuOpen, setMenuOpen] = useState(false);
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const shouldSaveApplication = useAppSelector(
    ApplicationSelectors.selectShouldSaveApplication,
  );
  const hasUnsavedChanges = useAppSelector(
    ApplicationSelectors.selectHasUnsavedChanges,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const returnConversationIds = useAppSelector(
    ApplicationSelectors.selectReturnConversationIds,
  );

  const tabs = useMemo(
    () => [
      {
        key: TabKeys.GENERAL,
        label: t('General info'),
        href: {
          pathname: Routes.AppsEditorGeneralInfo,
          query: { id, slug, add, publicationUrl },
        },
      },
      {
        key: TabKeys.SETTINGS,
        label: t('App settings'),
        href: {
          pathname: Routes.AppsEditorSettings,
          query: { id, slug, add, publicationUrl },
        },
      },
    ],
    [t, id, slug, add, publicationUrl],
  );

  const selectedTab =
    tabs.find((tab) => tab.href.pathname === pathname) || tabs[0];

  const capitalizedAppType =
    applicationTypeDisplayName.charAt(0).toUpperCase() +
    applicationTypeDisplayName.slice(1);

  let labelText = selectedTab.label.toLowerCase();

  if (selectedTab.key === TabKeys.SETTINGS) {
    labelText = labelText.replace(/^app\s+/i, '');
  }

  const label = `${capitalizedAppType} ${labelText}`;

  const handleCloseUserSettings = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  }, [dispatch]);

  const handleTabClick = (isDisabled: boolean) => {
    return (e: React.MouseEvent) => {
      if (isDisabled) {
        e.preventDefault();
        return;
      }

      if (hasUnsavedChanges) {
        dispatch(ApplicationActions.setShouldSaveApplication(true));
        dispatch(ApplicationActions.setHasUnsavedChanges(false));
      }
    };
  };

  const handleTabClose = (tabHref: UrlObject, isDisabled: boolean) => {
    if (isDisabled) return;
    setMenuOpen(false);
    push(tabHref);
  };

  const handleSaveAndRedirect = () => {
    if (!shouldSaveApplication) {
      dispatch(ApplicationActions.setShouldSaveApplication(true));
      dispatch(ApplicationActions.setExitAfterSave(true));
    }
  };

  const agent = modelsMap[id as string];

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

  useBeforeRedirect(handleCustomViewerExit, anyRouteExceptAppEditorRegex);

  return (
    <div
      className={classNames(
        'z-40 flex w-full border-b border-secondary bg-layer-1',
        isOverlay ? 'min-h-[36px]' : 'min-h-[48px]',
      )}
      data-qa="app-editor-header"
    >
      <div className="flex grow items-center justify-between">
        <div className="flex h-full space-x-4">
          <div className="relative flex items-center md:hidden">
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1 text-base font-medium text-primary"
            >
              {label}
              <IconChevronDown
                size={18}
                className={classNames(
                  'transition-transform',
                  menuOpen && 'rotate-180',
                )}
              />
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-7 z-10 ml-3 mt-2 w-[168px] overflow-hidden rounded-md bg-layer-3">
                {tabs.map((tab) => {
                  const isDisabled = tab.key === TabKeys.SETTINGS && !id;
                  const isActive = pathname === tab.href.pathname;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => handleTabClose(tab.href, isDisabled)}
                      disabled={isDisabled}
                      className={classNames(
                        'w-full px-3 py-2 text-left text-sm transition-colors',
                        {
                          'cursor-not-allowed text-secondary': isDisabled,
                          'bg-accent-primary-alpha': isActive && !isDisabled,
                          'hover:bg-gray-100': !isActive && !isDisabled,
                        },
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <span
            className="hidden items-center pl-1 text-primary md:flex xl:pl-0"
            data-qa="action-application-type-title"
          >
            {isEditApplication && !add ? t('Edit') : t('Add')}{' '}
            {applicationTypeDisplayName}
          </span>
          <div
            className="hidden items-center md:flex"
            data-qa="steps-container"
          >
            {tabs.map((tab, index) => {
              const isDisabled = tab.key === TabKeys.SETTINGS && !id;
              return (
                <div key={tab.key} className="flex items-center">
                  <Link
                    href={tab.href}
                    className={isDisabled ? 'pointer-events-none' : ''}
                    data-qa="single-step-link"
                    aria-disabled={isDisabled}
                    tabIndex={isDisabled ? -1 : undefined}
                    passHref
                  >
                    <div
                      className={classNames(
                        'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent-primary-alpha',
                        isDisabled ? 'text-secondary' : 'text-primary',
                      )}
                      onClick={handleTabClick(isDisabled)}
                    >
                      {tab.href.pathname !== pathname && id ? (
                        <IconCircleCheck
                          className="text-accent-primary"
                          data-qa="selected-step-icon"
                          width={24}
                          height={24}
                        />
                      ) : (
                        <IconCircleDot
                          className={
                            isDisabled
                              ? 'text-secondary'
                              : 'text-accent-primary'
                          }
                          data-qa="not-selected-step-icon"
                          width={24}
                          height={24}
                        />
                      )}
                      <span
                        className="grow truncate"
                        data-qa="single-step-title"
                      >
                        {tab.label}
                      </span>
                    </div>
                  </Link>
                  {index < tabs.length - 1 && (
                    <div
                      className="mx-2 h-0.5 w-5"
                      style={{ backgroundColor: 'var(--text-secondary)' }}
                    ></div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden h-full xl:flex">
          <Logo />
        </div>

        <div className="flex h-full items-center space-x-2 pr-3 md:pr-5 xl:pr-0">
          {isEditApplication &&
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
          )}
          <div className="h-full max-xl:hidden max-md:pr-2 md:border-l md:border-secondary md:pl-2">
            <User />
          </div>
        </div>
      </div>

      <SettingDialog
        open={isUserSettingsOpen}
        onClose={handleCloseUserSettings}
      />
    </div>
  );
};
