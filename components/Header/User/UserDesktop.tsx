import { IconSettings } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';
import Image from 'next/image';

import { useAppDispatch } from '@/store/hooks';
import { UIActions } from '@/store/ui/ui.reducers';

import { ConfirmDialog } from '@/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/components/Common/DropdownMenu';

import ChevronDownIcon from '../../../public/images/icons/chevron-down.svg';
import LogOutIcon from '../../../public/images/icons/log-out.svg';
import UserIcon from '../../../public/images/icons/user.svg';

export const UserDesktop = () => {
  const { t } = useTranslation('header');
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);
  const { data: session } = useSession();
  const dispatch = useAppDispatch();
  const handleLogout = useCallback(() => {
    session
      ? signOut({ redirect: true })
      : signIn('azure-ad', { redirect: true });
  }, [session]);

  return (
    <>
      <Menu
        className="w-full"
        onOpenChange={setIsOpen}
        trigger={
          <div className="flex min-w-[120px] items-center justify-between gap-2 pr-3">
            <div className="flex items-center gap-3">
              {session?.user?.image ? (
                <Image
                  className="rounded"
                  src={session?.user?.image}
                  width={18}
                  height={18}
                  alt={t(`User avatar`)}
                />
              ) : (
                <UserIcon width={18} height={18} />
              )}

              <span className="grow">{session?.user?.name || t('User')}</span>
            </div>
            <ChevronDownIcon
              className={`shrink-0 text-gray-800 transition-all dark:text-gray-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
              width={18}
              height={18}
            />
          </div>
        }
      >
        <MenuItem
          className={`hover:bg-blue-500/20`}
          item={
            <div className="flex">
              <IconSettings size={18} className="text-gray-500" />
              <span className="ml-3">{t('Settings')}</span>
            </div>
          }
          onClick={() => {
            dispatch(UIActions.setIsUserSettingsOpen(true));
          }}
        />
        <MenuItem
          className={`hover:bg-blue-500/20`}
          item={
            <div className="flex gap-3">
              <LogOutIcon width={18} height={18} className="text-gray-500" />
              <span>{session ? t('Log out') : t('Login')}</span>
            </div>
          }
          onClick={() => {
            if (!session) {
              handleLogout();
              return;
            }
            setIsLogoutConfirmationOpened(true);
          }}
        />
      </Menu>
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
