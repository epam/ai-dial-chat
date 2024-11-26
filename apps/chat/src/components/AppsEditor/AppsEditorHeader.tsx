import Link from 'next/link';

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

export const AppsEditorHeader = () => {
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
    `api/${ApiUtils.encodeApiUrl(customLogo)}`;

  const handleCloseUserSettings = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };

  return (
    <div
      className={classNames(
        'z-40 flex w-full border-b border-tertiary bg-layer-3',
        isOverlay ? 'min-h-[36px]' : 'min-h-[48px]',
      )}
      data-qa="header"
    >
      <div className="flex grow justify-between">
        <span
          className={classNames(
            'mx-auto min-w-[110px] bg-contain bg-center bg-no-repeat md:ml-5 lg:bg-left',
          )}
          style={{
            backgroundImage: customLogoUrl
              ? `url(${cssEscape(customLogoUrl)})`
              : `var(--app-logo)`,
          }}
        ></span>
        <div className="flex items-center space-x-4">
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
