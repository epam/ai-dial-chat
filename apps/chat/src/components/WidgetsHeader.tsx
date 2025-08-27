import { IconArrowLeft } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { ApplicationActions, UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { BaseHeader } from '@/src/components/Header/BaseHeader';
import { User } from '@/src/components/Header/User/User';
import { SettingDialog } from '@/src/components/Settings/SettingDialog';

export const WidgetsHeader = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const isUserSettingsOpen = useAppSelector(
    UISelectors.selectIsUserSettingsOpen,
  );
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const handleClose = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(false));
  }, [dispatch]);

  const handleGoBack = useCallback(() => {
    router.push(Routes.Widgets).then(() => {
      dispatch(ApplicationActions.setSelectedWidget(undefined));
    });
  }, [dispatch, router]);

  const iconSize = isOverlay ? 18 : 24;

  return (
    <BaseHeader
      LeftItems={
        router.route === Routes.SelectedWidget && isSmallScreen() ? (
          <div className="flex w-[48px] items-center justify-center text-secondary">
            <IconArrowLeft
              width={iconSize}
              height={iconSize}
              onClick={handleGoBack}
            />
          </div>
        ) : undefined
      }
      RightItems={
        <>
          <div className="w-[48px] md:w-auto">
            <User />
          </div>

          <SettingDialog open={isUserSettingsOpen} onClose={handleClose} />
        </>
      }
    />
  );
};
