/*eslint-disable @next/next/no-img-element*/
import { IconSettings } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { useIsSmallScreenOrMobile } from '@/src/utils/app/mobile';

import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { FAQ_URL } from '@/src/constants/header';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import Tooltip from '@/src/components/Common/Tooltip';

import LogOutIcon from '../../../../public/images/icons/log-out.svg';
import UserDesktopIcon from '../../../../public/images/icons/user-desktop.svg';

import { InfoIcon, TourGuideIcon } from '@/src/icons';

export const UserDesktop = () => {
  const { t } = useTranslation(Translation.Header);
  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);
  const [isClient, setIsClient] = useState(false);
  const isSmallScreenOrMobile = useIsSmallScreenOrMobile();
  const { data: session } = useSession();
  const dispatch = useAppDispatch();
  const handleLogout = useCallback(() => {
    session
      ? signOut({ redirect: true })
      : signIn('azure-ad', { redirect: true });
  }, [session]);

  const startTour = () => {
    if (isSmallScreenOrMobile) return;

    dispatch(UIActions.setTourRun(true));
    dispatch(UIActions.setTourStepIndex(0));
  };

  //hide TourGuide for smaller screens and mobile
  useEffect(() => {
    dispatch(UIActions.setTourRun(false));
    dispatch(UIActions.setTourStepIndex(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSmallScreenOrMobile]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <div className="flex items-center justify-center">
      <div
        className={isClient && isSmallScreenOrMobile ? 'invisible' : 'visible'}
      >
        <Tooltip isTriggerClickable tooltip={t('Tour Guide')}>
          <button onClick={startTour} className=" hover:text-accent-primary">
            <TourGuideIcon />
          </button>
        </Tooltip>
      </div>

      <Menu
        className="w-full"
        trigger={
          <div
            className="flex h-full min-w-[120px] items-center justify-end gap-2 pl-5 pr-3 hover:cursor-pointer hover:text-accent-primary"
            data-qa="account-settings"
          >
            <span>{session?.user?.name || t('User')}</span>

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
                <UserDesktopIcon width={30} height={30} />
              )}
            </div>
          </div>
        }
      >
        <MenuItem
          item={
            <div className="flex">
              <IconSettings size={18} />
              <span className="ml-3 font-medium">{t('Settings')}</span>
            </div>
          }
          onClick={() => {
            dispatch(UIActions.setIsUserSettingsOpen(true));
          }}
        />
        <MenuItem
          item={
            <div className="flex">
              <InfoIcon />
              <span className="ml-3 font-medium">{t('FAQ')}</span>
            </div>
          }
          onClick={() => {
            window.open(FAQ_URL, '_blank', 'noopener,noreferrer');
          }}
        />
        <MenuItem
          item={
            <div className="flex gap-3 font-medium">
              <LogOutIcon width={18} height={18} />
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
    </div>
  );
};
