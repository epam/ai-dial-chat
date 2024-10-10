/*eslint-disable @next/next/no-img-element*/
import { IconSettings } from '@tabler/icons-react';
import { signIn, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { customSignOut } from '@/src/utils/auth/signOut';

import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import ChevronDownIcon from '../../../../public/images/icons/chevron-down.svg';
import LogOutIcon from '../../../../public/images/icons/log-out.svg';
import UserIcon from '../../../../public/images/icons/user.svg';

import { Inversify } from '@epam/modulify-ui';

export const UserDesktop = Inversify.register('UserDesktop', () => {
  const { t } = useTranslation(Translation.Header);
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);
  const { data: session } = useSession();
  const dispatch = useAppDispatch();
  const handleLogout = useCallback(() => {
    session ? customSignOut() : signIn('azure-ad', { redirect: true });
  }, [session]);

  return (
    <>
      <Menu
        className="flex w-full items-center"
        onOpenChange={setIsOpen}
        trigger={
          <div
            className="flex w-full min-w-[120px] cursor-pointer items-center justify-between gap-2 pr-3"
            data-qa="account-settings"
          >
            <div className="flex items-center gap-3">
              {session?.user?.image ? (
                <img
                  className="rounded"
                  src={session?.user?.image}
                  width={18}
                  height={18}
                  alt={t(`User avatar`) || ''}
                />
              ) : (
                <UserIcon width={18} height={18} />
              )}

              <span className="grow">{session?.user?.name || t('User')}</span>
            </div>
            <ChevronDownIcon
              className={`shrink-0 text-primary transition-all ${
                isOpen ? 'rotate-180' : ''
              }`}
              width={18}
              height={18}
            />
          </div>
        }
      >
        <MenuItem
          className="hover:bg-accent-primary-alpha"
          item={
            <div className="flex">
              <IconSettings size={18} className="text-secondary" />
              <span className="ml-3">{t('Settings')}</span>
            </div>
          }
          onClick={() => {
            dispatch(UIActions.setIsUserSettingsOpen(true));
          }}
        />
        <MenuItem
          className="hover:bg-accent-primary-alpha"
          item={
            <div className="flex gap-3">
              <LogOutIcon width={18} height={18} className="text-secondary" />
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
});
