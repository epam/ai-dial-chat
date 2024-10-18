import { IconX } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';
import { ApiUtils } from '@/src/utils/server/api';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import MoveLeftIcon from '../../../public/images/icons/move-left.svg';
import MoveRightIcon from '../../../public/images/icons/move-right.svg';
import Tooltip from '../Common/Tooltip';
import { User } from '../Header/User/User';

import { Feature } from '@epam/ai-dial-shared';
import cssEscape from 'css.escape';

export const MarketplaceHeader = () => {
  const { t } = useTranslation(Translation.Header);
  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const customLogo = useAppSelector(UISelectors.selectCustomLogo);

  const isCustomLogoFeatureEnabled: boolean = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CustomLogo),
  );

  const customLogoUrl =
    isCustomLogoFeatureEnabled &&
    customLogo &&
    `api/${ApiUtils.encodeApiUrl(customLogo)}`;

  const dispatch = useAppDispatch();

  const handleToggleFilterbar = useCallback(() => {
    if (!showFilterbar && isSmallScreen()) {
      dispatch(UIActions.setIsProfileOpen(false));
    }
    dispatch(UIActions.setShowMarketplaceFilterbar(!showFilterbar));
  }, [dispatch, showFilterbar]);

  const onClose = () => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  };

  const headerIconSize = isOverlay
    ? OVERLAY_HEADER_ICON_SIZE
    : DEFAULT_HEADER_ICON_SIZE;

  return (
    <div
      className={classNames(
        'z-40 flex w-full border-b border-tertiary bg-layer-3',
        isOverlay ? 'min-h-[36px]' : 'min-h-[48px]',
      )}
      data-qa="header"
    >
      <Tooltip isTriggerClickable tooltip={t('DIAL Marketplace')}>
        <div
          className="flex h-full cursor-pointer items-center justify-center border-r border-tertiary px-3 md:px-5"
          data-qa="left-panel-toggle"
          onClick={handleToggleFilterbar}
        >
          {showFilterbar ? (
            <>
              <IconX
                className="text-secondary md:hidden"
                width={headerIconSize}
                height={headerIconSize}
              />

              <MoveLeftIcon
                className="text-secondary hover:text-accent-secondary max-md:hidden"
                width={headerIconSize}
                height={headerIconSize}
              />
            </>
          ) : (
            <MoveRightIcon
              className="text-secondary hover:text-accent-secondary"
              width={headerIconSize}
              height={headerIconSize}
            />
          )}
        </div>
      </Tooltip>

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
        <div className="w-[48px] max-md:border-l max-md:border-tertiary md:w-auto">
          <User />
        </div>
      </div>

      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
