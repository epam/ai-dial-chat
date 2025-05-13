/*eslint-disable @next/next/no-img-element*/
import { IconLogout, IconSettings } from '@tabler/icons-react';
import { useState } from 'react';

import { useLogout } from '@/src/hooks/useLogout';
import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.selectors';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';
import UserIcon from '@/public/images/icons/user.svg';
import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature } from '@epam/ai-dial-shared';

export const UserDesktop = Inversify.register('UserDesktop', () => {
  const { t } = useTranslation(Translation.Header);
  const [isOpen, setIsOpen] = useState(false);
  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);
  const { session, handleLogout } = useLogout();
  const dispatch = useAppDispatch();
  const isHideUserSettingsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.HideUserSettings),
  );

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
                  alt={t(`User avatar`)}
                />
              ) : (
                <UserIcon width={18} height={18} />
              )}

              <span className="grow" data-qa="username">
                {session?.user?.name || t('User')}
              </span>
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
        {!isHideUserSettingsEnabled && (
          <MenuItem
            id="user-settings-menu-item"
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
        )}
        <MenuItem
          id="logout-menu-item"
          className="hover:bg-accent-primary-alpha"
          item={
            <div className="flex gap-3">
              <IconLogout width={18} height={18} className="text-secondary" />
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
        description={t('Are you sure that you want to log out?')}
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
