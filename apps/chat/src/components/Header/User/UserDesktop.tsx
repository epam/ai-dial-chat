import { IconLogout, IconSettings } from '@tabler/icons-react';
import { useState } from 'react';

import { useLogout } from '@/src/hooks/useLogout';
import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/selectors';

import { HeaderI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';

import { UserIcon } from './UserIcon';

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
        listClassName="!w-[280px] border border-secondary"
        placement="bottom-end"
        trigger={
          <div
            className="flex w-full cursor-pointer items-center justify-start gap-2 pe-3 rtl:justify-end"
            data-qa="account-settings"
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <UserIcon
                userName={session?.user?.name || t(HeaderI18nKeys.User)}
              />
            </div>
          </div>
        }
      >
        <div className="flex flex-row items-center gap-3 border-b border-secondary p-3">
          <UserIcon userName={session?.user?.name || t(HeaderI18nKeys.User)} />

          <p className="break-words text-[14px]/[20px] font-semibold">
            {session?.user?.name}
          </p>
        </div>
        {!isHideUserSettingsEnabled && (
          <MenuItem
            id="user-settings-menu-item"
            className="hover:bg-accent-primary-alpha"
            item={
              <div className="flex">
                <IconSettings size={18} className="text-secondary" />
                <span className="ms-3">{t(HeaderI18nKeys.Settings)}</span>
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
              <IconLogout size={18} className="text-secondary" />
              <span>
                {session ? t(HeaderI18nKeys.LogOut) : t(HeaderI18nKeys.Login)}
              </span>
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
        heading={t(HeaderI18nKeys.ConfirmLogout)}
        description={t(HeaderI18nKeys.ConfirmLogoutDescription)}
        confirmLabel={t(HeaderI18nKeys.LogOut)}
        cancelLabel={t(HeaderI18nKeys.Cancel)}
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
