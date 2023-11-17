import { IconSettings } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { FooterMessage } from '@/src/components/Chat/FooterMessage';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import LogOutIcon from '../../../../public/images/icons/log-out.svg';
import UserIcon from '../../../../public/images/icons/user.svg';

const UserInfo = () => {
  const { data: session } = useSession();
  return (
    <div className=" w-full border-b border-gray-300 p-2 text-gray-800 dark:border-gray-900 dark:text-gray-200">
      <div className="flex h-[42px] items-center">
        <UserIcon className="mx-2" width={18} height={18} />

        <span className="grow">{session?.user?.name ?? ''}</span>
      </div>
    </div>
  );
};

const UserSettings = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('sidebar');

  const onClick = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(true));
  }, [dispatch]);

  return (
    <div className="flex h-[42px] items-center gap-2 px-2" onClick={onClick}>
      <IconSettings className="text-gray-500" size={18} />
      <span>{t('Settings')}</span>
    </div>
  );
};

const Logout = () => {
  const { data: session } = useSession();
  const { t } = useTranslation('sidebar');
  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);

  const handleLogout = useCallback(() => {
    session
      ? signOut({ redirect: true })
      : signIn('azure-ad', { redirect: true });
  }, [session]);
  return (
    <>
      <div
        className="flex h-[42px] items-center gap-2 px-2"
        onClick={() => {
          if (!session) {
            handleLogout();
            return;
          }
          setIsLogoutConfirmationOpened(true);
        }}
      >
        <LogOutIcon className="text-gray-500" width={18} height={18} />
        <span>{session ? t('Log out') : t('Login')}</span>
      </div>
      <ConfirmDialog
        isOpen={isLogoutConfirmationOpened}
        heading={t('Confirm logging out')}
        description={t('Are you sure that you want to log out?') || ''}
        confirmLabel={t('Log out')}
        cancelLabel={t('Cancel')}
        onClose={(result) => {
          setIsLogoutConfirmationOpened(false);
          if (result) {
            handleLogout();
          }
        }}
      />
    </>
  );
};
const UserMenu = () => {
  return (
    <div className="flex flex-col gap-1 p-2">
      <UserSettings />
      <Logout />
    </div>
  );
};

export const UserMobile = () => {
  return (
    <div
      className="fixed right-0 top-12 z-40 flex w-[260px] flex-col overflow-y-auto border-gray-300 bg-gray-100 dark:border-gray-900 dark:bg-gray-700 md:hidden"
      style={{ height: 'calc(100% - 48px)' }}
    >
      <UserInfo />
      <UserMenu />
      <div className="grow"></div>
      <div className="border-t border-gray-300 p-4 dark:border-gray-900">
        <FooterMessage />
      </div>
    </div>
  );
};
