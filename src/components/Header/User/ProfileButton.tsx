import { useSession } from 'next-auth/react';
import { useCallback } from 'react';

import { useTranslation } from 'next-i18next';
import Image from 'next/image';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import UserIcon from '../../../../public/images/icons/user.svg';
import XmarkIcon from '../../../../public/images/icons/xmark.svg';

export const ProfileButton = () => {
  const isProfileOpen = useAppSelector(UISelectors.selectIsProfileOpen);
  const dispatch = useAppDispatch();

  const { t } = useTranslation('sidebar');
  const { data: session } = useSession();

  const onClick = useCallback(() => {
    dispatch(UIActions.setIsProfileOpen(!isProfileOpen));
  }, [dispatch, isProfileOpen]);

  return (
    <button
      className="flex h-full w-full items-center justify-center"
      onClick={onClick}
    >
      {isProfileOpen ? (
        <XmarkIcon className="text-gray-500" width={24} height={24} />
      ) : session?.user?.image ? (
        <img
          className="rounded"
          src={session?.user?.image}
          width={24}
          height={24}
          alt={t(`User avatar`) || ''}
        />
      ) : (
        <UserIcon width={18} height={18} />
      )}
    </button>
  );
};
