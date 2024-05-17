/*eslint-disable @next/next/no-img-element*/
import { IconSettings } from '@tabler/icons-react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { useIsSmallScreenOrMobile } from '@/src/utils/app/mobile';

import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import Tooltip from '@/src/components/Common/Tooltip';

import ChevronDownIcon from '../../../../public/images/icons/chevron-down.svg';
import LogOutIcon from '../../../../public/images/icons/log-out.svg';
import UserIcon from '../../../../public/images/icons/user.svg';

import { TourGuideIcon } from '@/src/icons';

export const UserDesktop = () => {
  const { t } = useTranslation(Translation.Header);
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);
  const isSmallScreenOrMobile = useIsSmallScreenOrMobile();
  const { data: session } = useSession();
  const dispatch = useAppDispatch();
  const handleLogout = useCallback(() => {
    session
      ? signOut({ redirect: true })
      : signIn('azure-ad', { redirect: true });
  }, [session]);

  const startTour = () => {
    dispatch(UIActions.setTourRun(true));
    dispatch(UIActions.setTourStepIndex(0));
  };

  //hide TourGuide for smaller screens and mobile
  useEffect(() => {
    dispatch(UIActions.setTourRun(false));
    dispatch(UIActions.setTourStepIndex(0));
  }, [isSmallScreenOrMobile]);

  return (
    <div className="mt-[15px] flex items-center justify-center">
      {!isSmallScreenOrMobile && (
        <Tooltip isTriggerClickable tooltip={t('Tour Guide')}>
          <button onClick={startTour} className="ml-[25px] mr-[25px]">
            <TourGuideIcon />
          </button>
        </Tooltip>
      )}

      <Menu
        className="w-full"
        onOpenChange={setIsOpen}
        trigger={
          <div
            className="flex min-w-[120px] items-center justify-between gap-2 pr-3"
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
    </div>
  );
};
