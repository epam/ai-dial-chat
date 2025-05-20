/*eslint-disable @next/next/no-img-element*/
import { IconLogout, IconSettings } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import classNames from 'classnames';

import { useLogout } from '@/src/hooks/useLogout';
import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { UIActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors, UISelectors } from '@/src/store/selectors';

import { CloseSidebarButton } from '@/src/components/Buttons/CloseSidebarButton';
import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { FooterMessage } from '@/src/components/Common/FooterMessage';
import { withRenderWhen } from '@/src/components/Common/RenderWhen';
import { withRenderForScreen } from '@/src/components/Common/ScreenRender';

import UserIcon from '@/public/images/icons/user.svg';
import { Inversify } from '@epam/ai-dial-modulify-ui';
import { Feature } from '@epam/ai-dial-shared';

const UserInfo = () => {
  const { t } = useTranslation(Translation.Header);

  const { data: session } = useSession();

  return (
    <div className="w-full border-b border-tertiary p-2 text-primary">
      <div className="flex h-[42px] items-center">
        {session?.user?.image ? (
          <img
            className="mx-2 rounded"
            src={session?.user?.image}
            width={18}
            height={18}
            alt={t('User avatar')}
          />
        ) : (
          <UserIcon className="mx-2 text-secondary" width={18} height={18} />
        )}

        <span className="grow" data-qa="username">
          {session?.user?.name ?? ''}
        </span>
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
      id="user-settings-menu-item"
      className="flex h-[42px] cursor-pointer items-center gap-2 px-2"
      onClick={onClick}
    >
      <IconSettings className="text-secondary" size={18} />
      <span>{t('Settings')}</span>
    </div>
  );
};

const Logout = () => {
  const { session, handleLogout } = useLogout();
  const { t } = useTranslation(Translation.Header);
  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);

  return (
    <>
      <div
        id="logout-menu-item"
        className="flex h-[42px] cursor-pointer items-center gap-2 px-2"
        onClick={() => {
          if (!session) {
            handleLogout();
            return;
          }
          setIsLogoutConfirmationOpened(true);
        }}
      >
        <IconLogout className="text-secondary" size={18} />
        <span>{session ? t('Log out') : t('Login')}</span>
      </div>
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
};
const UserMenu = () => {
  const isHideUserSettingsEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.HideUserSettings),
  );
  return (
    <div className="flex flex-col gap-1 p-2">
      {!isHideUserSettingsEnabled && <UserSettings />}
      <Logout />
    </div>
  );
};

const UserMobileView = Inversify.register('UserMobile', () => {
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);

  const dispatch = useAppDispatch();

  const screenState = useScreenState();

  const handleClose = useCallback(() => {
    dispatch(UIActions.setIsProfileOpen(false));
  }, [dispatch]);

  return (
    <div
      className={classNames(
        'absolute right-0 z-40 flex w-[260px] flex-col border-tertiary bg-layer-3 md:hidden',
        (screenState === ScreenState.SM || screenState === ScreenState.MD) &&
          'top-0 !h-full',
        screenState !== ScreenState.SM &&
          screenState !== ScreenState.MD &&
          (isOverlay
            ? 'top-9 !h-[calc(100%-36px)]'
            : 'top-12 !h-[calc(100%-48px)]'),
      )}
      data-qa="profile-panel"
    >
      <CloseSidebarButton onClose={handleClose} isLeftSide={false} />
      <UserInfo />
      <UserMenu />
      <div className="grow"></div>
      <div className="border-t border-tertiary p-4 empty:hidden">
        <FooterMessage />
      </div>
    </div>
  );
});

export const UserMobile = withRenderForScreen([ScreenState.SM])(
  withRenderWhen(UISelectors.selectIsProfileOpen)(UserMobileView),
);
