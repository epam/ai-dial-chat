import Link from 'next/link';

import classNames from 'classnames';

import { ApiUtils } from '@/src/utils/server/api';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import CircleIndicator from '../../../public/images/icons/circle-indicator.svg';
import LogOutIcon from '../../../public/images/icons/log-out.svg';

import { Feature } from '@epam/ai-dial-shared';
import cssEscape from 'css.escape';

export enum TabKeys {
  GENERAL = 'general',
  SETTINGS = 'settings',
}

enum TabLabels {
  GENERAL = 'General info',
  SETTINGS = 'App settings',
}

interface Props {
  activeTab: TabKeys;
}

export const AppsEditorHeader = ({ activeTab }: Props) => {
  const dispatch = useAppDispatch();

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
    { key: TabKeys.GENERAL, label: TabLabels.GENERAL },
    { key: TabKeys.SETTINGS, label: TabLabels.SETTINGS },
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
            {tabs.map((tab, index) => (
              <div key={tab.key} className="flex items-center px-2">
                <CircleIndicator
                  className={classNames(
                    activeTab === tab.key
                      ? 'text-accent-primary'
                      : 'text-secondary',
                  )}
                  width={24}
                  height={24}
                />
                <span
                  className={classNames(
                    'px-2',
                    activeTab === tab.key ? 'text-primary' : 'text-secondary',
                  )}
                >
                  {tab.label}
                </span>
                {index < tabs.length - 1 && (
                  <div
                    className="mx-2 h-0.5 w-5"
                    style={{ backgroundColor: 'var(--text-secondary)' }}
                  ></div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            className="flex items-center space-x-1 hover:text-accent-primary"
            href="/marketplace"
          >
            <LogOutIcon width={14} height={14} />
            <span>Exit editor</span>
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
