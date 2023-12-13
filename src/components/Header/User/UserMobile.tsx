import { IconSettings } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { FooterMessage } from '@/src/components/Common/FooterMessage';

import LogOutIcon from '../../../../public/images/icons/log-out.svg';
import UserIcon from '../../../../public/images/icons/user.svg';

const UserInfo = () => {
  const { data: session } = useSession();
  return (
    <div className=" border-gray-300 w-full border-b p-2 text-primary">
      <div className="flex h-[42px] items-center">
        <UserIcon className="mx-2" width={18} height={18} />

        <span className="grow">{session?.user?.name ?? ''}</span>
      </div>
    </div>
  );
};

const UserSettings = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.SideBar);

  const onClick = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(true));
  }, [dispatch]);

  return (
    <div className="flex h-[42px] items-center gap-2 px-2" onClick={onClick}>
      <IconSettings className="text-secondary" size={18} />
      <span>{t('Settings')}</span>
    </div>
  );
};

const Logout = () => {
  const { data: session } = useSession();
  const { t } = useTranslation(Translation.SideBar);
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
        <LogOutIcon className="text-secondary" width={18} height={18} />
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
      className="border-gray-300 bg-gray-100 fixed right-0 top-12 z-40 flex w-[260px] flex-col overflow-y-auto md:hidden"
      style={{ height: 'calc(100% - 48px)' }}
    >
      <UserInfo />
      <UserMenu />
      <div className="grow"></div>
      <div className="border-gray-300 border-t p-4">
        <FooterMessage />
      </div>
    </div>
  );
};
