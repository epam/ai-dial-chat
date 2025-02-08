import { IconX } from '@tabler/icons-react';
import { useCallback } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import { Logo } from '@/src/components/Header/Logo';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import Tooltip from '../Common/Tooltip';
import { BackToChat } from '../Header/BackToChat';
import { User } from '../Header/User/User';

import MoveLeftIcon from '@/public/images/icons/move-left.svg';
import MoveRightIcon from '@/public/images/icons/move-right.svg';

export const MarketplaceHeader = () => {
  const { t } = useTranslation(Translation.Header);
  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

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
      <Tooltip isTriggerClickable tooltip={t('Control panel')}>
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
                className="text-secondary hover:text-accent-primary max-md:hidden"
                width={headerIconSize}
                height={headerIconSize}
              />
            </>
          ) : (
            <MoveRightIcon
              className="text-secondary hover:text-accent-primary"
              width={headerIconSize}
              height={headerIconSize}
            />
          )}
        </div>
      </Tooltip>
      <BackToChat />
      <div className="flex grow justify-between">
        <Logo />
        <div className="w-[48px] max-md:border-l max-md:border-tertiary md:w-auto">
          <User />
        </div>
      </div>

      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
