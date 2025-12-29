import { useCallback } from 'react';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import {
  DEFAULT_HEADER_ICON_SIZE,
  OVERLAY_HEADER_ICON_SIZE,
} from '@/src/constants/default-ui-settings';

import { ToggleSidebarButton } from '@/src/components/Buttons/ToggleSidebarButton';
import { BaseHeader } from '@/src/components/Header/BaseHeader';
import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

import { Feature } from '@epam/ai-dial-shared';

export const MarketplaceHeader = () => {
  const showFilterbar = useAppSelector(
    UISelectors.selectShowMarketplaceFilterbar,
  );
  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isUserMenuHidden = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.HideUserMenu),
  );

  const dispatch = useAppDispatch();

  const handleToggleFilterbar = useCallback(() => {
    if (!showFilterbar && isSmallScreen()) {
      dispatch(UIActions.setIsProfileOpen(false));
    }
    dispatch(UIActions.setShowMarketplaceFilterbar(!showFilterbar));
  }, [dispatch, showFilterbar]);

  const onClose = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  }, [dispatch]);

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
        !isUserMenuHidden && (
          <>
            <div className="w-[48px] overflow-hidden md:w-auto">
              <User />
            </div>

            <SettingDialog open={isUserSettingsOpen} onClose={onClose} />
          </>
        )
      }
    />
  );
};
