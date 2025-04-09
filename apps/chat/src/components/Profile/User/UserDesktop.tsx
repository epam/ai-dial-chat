/*eslint-disable @next/next/no-img-element*/
import { IconLogout, IconSettings } from '@tabler/icons-react';
import { useState } from 'react';

import { useLogout } from '@/src/hooks/useLogout';
import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { UserAvatar } from './UserAvatar';

import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature } from '@epam/ai-dial-shared';

export const UserDesktop = Inversify.register('UserDesktop', () => {
  const { t } = useTranslation(Translation.Header);

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
        listClassName="min-w-[120px]"
        trigger={
          <div
            className="flex w-full cursor-pointer items-center"
            data-qa="account-settings"
          >
            <div className="flex items-center gap-3">
              <UserAvatar />
            </div>
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
