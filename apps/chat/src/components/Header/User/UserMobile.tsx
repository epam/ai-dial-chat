/*eslint-disable @next/next/no-img-element*/
import { IconSettings } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { FooterMessage } from '@/src/components/Common/FooterMessage';

import LogOutIcon from '../../../../public/images/icons/log-out.svg';
import UserMobileIcon from '../../../../public/images/icons/user-mobile.svg';

const UserInfo = () => {
  const { t } = useTranslation(Translation.Header);

  const { data: session } = useSession();

  return (
    <div className="w-full border-b border-tertiary p-2 text-primary-bg-dark">
      <div className="flex h-[42px] items-center">
        {session?.user?.image ? (
          <img
            className="mx-2 rounded"
            src={session?.user?.image}
            width={18}
            height={18}
            alt={t('header.user_avatar.label') || ''}
          />
        ) : (
          <UserMobileIcon className="mx-2" width={18} height={18} />
        )}

        <span className="grow">{session?.user?.name ?? ''}</span>
      </div>
    </div>
  );
};

const UserSettings = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.Header);

  const onClick = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(true));
  }, [dispatch]);

  return (
    <div
      className="flex h-[42px] cursor-pointer items-center gap-2 px-2"
      onClick={onClick}
    >
      <IconSettings className="text-primary-bg-dark" size={18} />
      <span>{t('header.settings.label')}</span>
    </div>
  );
};

const Logout = () => {
  const { data: session } = useSession();
  const { t } = useTranslation(Translation.Header);
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
        className="flex h-[42px] cursor-pointer items-center gap-2 px-2"
        onClick={() => {
          if (!session) {
            handleLogout();
            return;
          }
          setIsLogoutConfirmationOpened(true);
        }}
      >
        <LogOutIcon className="text-primary-bg-dark" width={18} height={18} />
        <span>
          {session ? t('header.logout.label') : t('header.login.label')}
        </span>
      </div>
      <ConfirmDialog
        isOpen={isLogoutConfirmationOpened}
        heading={t('header.dialog.confirm_logout.header')}
        description={t('header.dialog.confirm_logout.description') || ''}
        confirmLabel={t('header.dialog.confirm_logout.button.logout')}
        cancelLabel={t('header.dialog.confirm_logout.button.cancel')}
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
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  return (
    <div
      className={classNames(
        'fixed right-0 z-40 flex w-[260px] flex-col overflow-y-auto border-tertiary bg-layer-3 md:hidden',
        isOverlay ? 'top-9 h-[calc(100%-36px)]' : 'top-12 h-[calc(100%-48px)]',
      )}
    >
      <UserInfo />
      <UserMenu />
      <div className="grow"></div>
      <div className="border-t border-tertiary p-4">
        <FooterMessage />
      </div>
    </div>
  );
};
