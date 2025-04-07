import { IconLogout, IconSettings } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useLogout } from '@/src/hooks/useLogout';

import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { ConfirmDialog } from '../Common/ConfirmDialog';
import { UserAvatar } from './UserAvatar';

interface ProfileSectionProps {
  children: React.ReactNode;
}

const ProfileSection: React.FC<ProfileSectionProps> = ({ children }) => {
  return <div className="flex flex-col gap-1 p-2">{children}</div>;
};

interface ProfileSectionItemProps {
  children: React.ReactNode;
  onClick?: () => void;
}

const ProfileSectionItem: React.FC<ProfileSectionItemProps> = ({
  children,
  onClick,
}) => {
  return (
    <div
      className={classNames(
        'flex items-center gap-2 rounded p-2',
        onClick && 'active:bg-accent-primary-alpha',
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

const ProfileUserSection = () => {
  const { data: session } = useSession();

  return (
    <ProfileSection>
      <ProfileSectionItem>
        <UserAvatar iconSize={18} />
        <span data-qa="username">{session?.user?.name ?? ''}</span>
      </ProfileSectionItem>
    </ProfileSection>
  );
};

const ProfileActionsSection = () => {
  const { t } = useTranslation(Translation.Common);

  const dispatch = useAppDispatch();

  const [isLogoutConfirmationOpened, setIsLogoutConfirmationOpened] =
    useState(false);

  const { handleLogout } = useLogout();

  const handleSettingsOpen = useCallback(() => {
    dispatch(UIActions.setIsUserSettingsOpen(true));
  }, [dispatch]);

  const handleOpenLogoutConfirmation = useCallback(() => {
    setIsLogoutConfirmationOpened(true);
  }, []);

  const handleResolveLogoutConfirmation = useCallback(
    (isConfirmed: boolean) => {
      setIsLogoutConfirmationOpened(false);
      if (isConfirmed) {
        handleLogout();
      }
    },
    [handleLogout],
  );

  return (
    <>
      <ProfileSection>
        <ProfileSectionItem onClick={handleSettingsOpen}>
          <IconSettings size={18} className="text-secondary" />
          <span data-qa="settings">{t('Settings')}</span>
        </ProfileSectionItem>
        <ProfileSectionItem onClick={handleOpenLogoutConfirmation}>
          <IconLogout size={18} className="text-secondary" />
          <span data-qa="logout">{t('Log out')}</span>
        </ProfileSectionItem>
      </ProfileSection>

      {isLogoutConfirmationOpened && (
        <ConfirmDialog
          isOpen
          heading={t('Confirm logging out')}
          description={t('Are you sure that you want to log out?') ?? ''}
          confirmLabel={t('Log out')}
          cancelLabel={t('Cancel')}
          onClose={handleResolveLogoutConfirmation}
        />
      )}
    </>
  );
};

export const ProfileSections = () => {
  return (
    <div className="divide-y divide-secondary">
      <ProfileUserSection />
      <ProfileActionsSection />
    </div>
  );
};
