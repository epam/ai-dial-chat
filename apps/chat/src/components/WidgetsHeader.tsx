import { IconArrowLeft } from '@tabler/icons-react';
import { useCallback } from 'react';

import { useRouter } from 'next/router';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { ApplicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { Routes } from '@/src/constants/routes';

import { BaseHeader } from '@/src/components/Header/BaseHeader';

export const WidgetsHeader = () => {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

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
    />
  );
};
