import { IconCircleCheck, IconCircleDot } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';
import Link from 'next/link';
import { useRouter } from 'next/router';

import classNames from 'classnames';

import { ApiUtils } from '@/src/utils/server/api';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import LogOutIcon from '../../../public/images/icons/log-out.svg';

import { Feature } from '@epam/ai-dial-shared';
import cssEscape from 'css.escape';

export enum TabKeys {
  GENERAL = 'general',
  SETTINGS = 'settings',
}

export const AppsEditorHeader = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { t } = useTranslation();

  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const customLogo = useAppSelector(UISelectors.selectCustomLogo);

  const isCustomLogoFeatureEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomLogo),
  );

  const customLogoUrl =
    isCustomLogoFeatureEnabled &&
    customLogo &&
    `/api/${ApiUtils.encodeApiUrl(customLogo)}`;

  const handleCloseUserSettings = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };

  const tabs = [
    {
      key: TabKeys.GENERAL,
      label: t('General info'),
      href: `/apps-editor/${router.query.slug}${router.query.id ? `?id=${router.query.id}` : ''}`,
    },
    {
      key: TabKeys.SETTINGS,
      label: t('Settings'),
      href: `/apps-editor/${router.query.slug}/settings${router.query.id ? `?id=${router.query.id}` : ''}`,
    },
  ];

  return (
    <div
      className={classNames(
        'z-40 flex w-full border-b border-tertiary bg-layer-3',
        isOverlay ? 'min-h-[36px]' : 'min-h-[48px]',
      )}
      data-qa="header"
    >
      <div className="flex grow justify-between">
        <div className="flex items-center space-x-4 md:ml-5">
          <span
            className={classNames(
              'mx-auto h-12 min-w-[110px] bg-contain bg-center bg-no-repeat md:ml-5 lg:bg-left',
            )}
            style={{
              backgroundImage: customLogoUrl
                ? `url(${cssEscape(customLogoUrl)})`
                : `var(--app-logo)`,
            }}
          ></span>
          <div className="h-full border-l border-tertiary"></div>
          <span className="text-primary">Add application</span>
          <div className="flex items-center">
            {tabs.map((tab, index) => {
              const isDisabled =
                tab.key === TabKeys.SETTINGS && !router.query.id;
              return (
                <div key={tab.key} className="flex items-center">
                  <Link
                    href={tab.href}
                    className={isDisabled ? 'pointer-events-none' : ''}
                    aria-disabled={isDisabled}
                    tabIndex={isDisabled ? -1 : undefined}
                    passHref
                  >
                    <div
                      className={classNames(
                        'flex cursor-pointer items-center px-2',
                        isDisabled ? 'text-secondary' : 'text-primary',
                      )}
                    >
                      {tab.key === TabKeys.GENERAL && router.query.id ? (
                        <IconCircleCheck
                          className={classNames('text-accent-primary')}
                          width={24}
                          height={24}
                        />
                      ) : (
                        <IconCircleDot
                          className={classNames(
                            isDisabled
                              ? 'text-secondary'
                              : 'text-accent-primary',
                          )}
                          width={24}
                          height={24}
                        />
                      )}

                      <span className="px-2">{tab.label}</span>
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

        <div className="flex items-center space-x-2">
          <Link
            className="flex items-center space-x-1 hover:text-accent-primary"
            href="/marketplace"
          >
            <LogOutIcon width={14} height={14} />
            <span>{t('Exit editor')}</span>
          </Link>

          <div className="h-full border-l border-tertiary px-4 max-md:border-tertiary">
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
