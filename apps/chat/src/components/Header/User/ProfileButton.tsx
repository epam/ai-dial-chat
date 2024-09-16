/*eslint-disable @next/next/no-img-element*/
import { IconX } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import UserIcon from '../../../../public/images/icons/user.svg';

export const ProfileButton = () => {
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Header);
  const { data: session } = useSession();

  const onClick = useCallback(() => {
    if (!isProfileOpen && isSmallScreen()) {
      dispatch(UIActions.setShowPromptbar(false));
      dispatch(UIActions.setShowChatbar(false));
      dispatch(UIActions.setShowMarketplaceFilterbar(false));
    }
    dispatch(UIActions.setIsProfileOpen(!isProfileOpen));
  }, [dispatch, isProfileOpen]);

  const iconSize = isOverlay ? 18 : 24;

  return (
    <button
      className="flex size-full items-center justify-center text-secondary md:text-primary"
      onClick={onClick}
    >
      {isProfileOpen ? (
        <IconX className="text-secondary" width={iconSize} height={iconSize} />
      ) : session?.user?.image ? (
        <img
          className="rounded"
          src={session?.user?.image}
          width={iconSize}
          height={iconSize}
          alt={t('User avatar') || ''}
        />
      ) : (
        <UserIcon width={iconSize} height={iconSize} />
      )}
    </button>
  );
};
