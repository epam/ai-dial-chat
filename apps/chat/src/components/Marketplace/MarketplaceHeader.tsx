import { useCallback } from 'react';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';
import { UISelectors } from '@/src/store/ui/ui.selectors';

import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { ToggleSidebarButton } from '../Common/Buttons/ToggleSidebarButtor';
import { BaseHeader } from '../Header/BaseHeader';
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
    <BaseHeader
      LeftItems={
        <ToggleSidebarButton
          iconSize={headerIconSize}
          tooltip="Control panel"
          isOpened={showFilterbar}
          onToggle={handleToggleFilterbar}
          dataQa="left-panel-toggle"
          isOverlay={isOverlay}
        />
      }
      RightItems={
        <>
          <div className="w-[48px] md:w-auto">
            <User />
          </div>

          <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
        </>
      }
    />
  );
};
