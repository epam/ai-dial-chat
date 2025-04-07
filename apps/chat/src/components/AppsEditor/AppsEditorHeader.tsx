import {
  IconCircleCheck,
  IconCircleDot,
  IconLogout,
  IconMenu2,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { DEFAULT_CONVERSATION_NAME } from '@/src/constants/default-ui-settings';
import { MarketplaceTabs } from '@/src/constants/marketplace';
import { Routes } from '@/src/constants/routes';

import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { Logo } from '../Header/Logo';

enum TabKeys {
  GENERAL = 'general',
  SETTINGS = 'settings',
}
interface AppsEditorHeaderProps {
  applicationTypeDisplayName: string;
  isEditApplication?: boolean;
  hasCustomEditor?: boolean;
  onExit?: () => void;
}

export const AppsEditorHeader: React.FC<AppsEditorHeaderProps> = ({
  applicationTypeDisplayName,
  isEditApplication,
  hasCustomEditor,
  onExit,
}) => {
  const dispatch = useAppDispatch();
  const {
    query: { id = '', slug = '', add },
    pathname,
  } = useRouter();
  const { t } = useTranslation(Translation.Chat);

  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const returnConversationIds = useAppSelector(
    ApplicationSelectors.selectReturnConversationIds,
  );

  const handleCloseUserSettings = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };

  const handleSaveAndRedirect = () => {
    onExit?.();
    dispatch(ApplicationActions.setExitAfterSave(true));
    dispatch(ApplicationActions.setShouldSaveApplication(true));
    if (returnConversationIds?.length) {
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
  };

  const tabs = useMemo(
    () => [
      {
        key: TabKeys.GENERAL,
        label: t('General info'),
        href: {
          pathname: Routes.AppsEditorGeneralInfo,
          query: {
            id,
            slug,
            add,
          },
        },
      },
      {
        key: TabKeys.SETTINGS,
        label: t('App settings'),
        href: {
          pathname: Routes.AppsEditorSettings,
          query: {
            id,
            slug,
            add,
          },
        },
      },
    ],
    [t, id, slug, add],
  );

  const [menuOpen, setMenuOpen] = useState(false);

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
          <div className="flex items-center space-x-4">
            <button
              className="p-2 text-primary md:hidden"
              onClick={() => setMenuOpen((prevState) => !prevState)}
            >
              {menuOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
            </button>
          </div>
          <Logo />
          <div className="h-full border-l border-secondary"></div>
          <span
            className="hidden items-center text-primary md:flex"
            data-qa="action-application-type-title"
          >
            {isEditApplication && !add ? t('Edit') : t('Add')}{' '}
            {applicationTypeDisplayName}
          </span>
          <div
            className="hidden items-center space-x-2 md:flex"
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
                        'flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 hover:bg-accent-primary-alpha',
                        isDisabled ? 'text-secondary' : 'text-primary',
                      )}
                    >
                      {tab.key === TabKeys.GENERAL && id ? (
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

        <div className="flex h-full items-center space-x-2">
          {isEditApplication && !hasCustomEditor ? (
            <button
              className="button flex items-center space-x-1 text-accent-primary md:flex"
              onClick={handleSaveAndRedirect}
              data-qa="save-and-exit"
            >
              <IconLogout size={14} />
              <span>{t('Save and exit')}</span>
            </button>
          ) : (
            <Link
              className="hidden items-center space-x-1 px-3 text-accent-primary md:flex"
              data-qa="exit-link"
              href={{
                pathname: Routes.Marketplace,
                query: { tab: MarketplaceTabs.MY_WORKSPACE },
              }}
            >
              <IconLogout size={14} />
              <span>{t('Exit')}</span>
            </Link>
          )}

          <div className="h-full max-md:pr-2 md:border-l md:border-secondary md:pl-2">
            <User />
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute left-0 top-[48px] w-full border-b border-secondary bg-layer-3 md:hidden">
          {tabs.map((tab) => {
            const isDisabled = tab.key === TabKeys.SETTINGS && !id;
            const isActive = pathname === tab.href.pathname;
            return (
              <Link key={tab.key} href={tab.href} passHref>
                <div
                  className={classNames(
                    'cursor-pointer border-b border-secondary px-4 py-2',
                    isDisabled ? 'text-secondary' : 'text-primary',
                    isActive && !isDisabled
                      ? 'font-semibold text-accent-primary'
                      : '',
                  )}
                  onClick={() => setMenuOpen(false)}
                >
                  {tab.label}
                </div>
              </Link>
            );
          })}
          <Link
            className="flex items-center px-4 py-2 hover:text-accent-primary"
            href={{
              pathname: Routes.Marketplace,
              query: { tab: MarketplaceTabs.MY_WORKSPACE },
            }}
          >
            <IconLogout size={14} />
            <span>{t('Go to marketplace')}</span>
          </Link>
        </div>
      )}

      <SettingDialog
        open={isUserSettingsOpen}
        onClose={handleCloseUserSettings}
      />
    </div>
  );
};
