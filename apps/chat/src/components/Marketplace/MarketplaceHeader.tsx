import { useCallback } from 'react';

import classNames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import { Logo } from '@/src/components/Header/Logo';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { ToggleSidebarButton } from '../Common/Buttons/ToggleSidebarButtor';
import { User } from '../Header/User/User';

export const MarketplaceHeader = () => {
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
        'z-30 flex w-full border-b border-secondary bg-layer-1',
        isOverlay ? 'min-h-[36px]' : 'min-h-[49px]',
      )}
      data-qa="header"
    >
      <ToggleSidebarButton
        iconSize={headerIconSize}
        tooltip="Control panel"
        isOpened={showFilterbar}
        onToggle={handleToggleFilterbar}
        dataQa="left-panel-toggle"
        isOverlay={isOverlay}
      />
      <div className="flex grow justify-center">
        <Logo />
      </div>
      <div className="w-[48px] max-md:border-l max-md:border-tertiary md:w-auto">
        <User />
      </div>

      <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
    </div>
  );
};
