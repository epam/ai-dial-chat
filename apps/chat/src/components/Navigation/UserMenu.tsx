/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialTooltip,
  DropdownItemType,
} from '@epam/ai-dial-ui-kit';
import { IconLogout, IconSettings } from '@tabler/icons-react';
import { readableColor } from 'polished';
import randomColor from 'randomcolor';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';
import SettingsModal from '../Settings/SettingsModal';
import AvatarInitials from './AvatarInitials';

export const UserMenu = memo(() => {
  const { status, user } = useUser();
  const { t } = useTranslation();

  const image = user?.claims?.['image'] as string | undefined;
  const [isFallbackIconShown, setIsFallbackIconShown] = useState(!image);
  const isMobile = useIsMobile();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const email = (user?.claims?.['email'] as string) ?? user?.sub ?? '';

  const bg = randomColor({
    luminosity: 'bright',
    seed: email,
  });

  const textColor = readableColor(bg);

  const shortName = useMemo(() => {
    const nameClaim = (user?.claims?.['name'] as string) || '';
    const [part1, part2] = nameClaim.includes(' ')
      ? nameClaim.split(' ')
      : [nameClaim[0], nameClaim[1]];
    if (part1 && part2) {
      return `${part1[0]}${part2[0]}`;
    }
    return nameClaim;
  }, [user?.claims]);

  if (status !== 'authenticated' || !user) {
    return null;
  }

  const avatar = isFallbackIconShown ? (
    <AvatarInitials bg={bg} textColor={textColor} shortName={shortName} />
  ) : (
    <img
      className="rounded-full"
      src={image}
      width={28}
      height={28}
      alt="User avatar"
      onError={() => setIsFallbackIconShown(true)}
    />
  );

  const menuItems = [
    {
      key: 'identity',
      type: DropdownItemType.PlainText,
      label: (
        <div className="flex items-center gap-2">
          <AvatarInitials bg={bg} textColor={textColor} shortName={shortName} />
          <span className="dial-small-semi-text truncate text-primary">
            {email}
          </span>
        </div>
      ),
    },
    { key: 'divider', type: DropdownItemType.Divider },
    {
      key: 'settings',
      label: (
        <span className="dial-small-text">{t(AuthI18nKeys.Settings)}</span>
      ),
      icon: <IconSettings size={DIAL_ICON_SIZE.SM} aria-hidden />,
      onClick: () => setIsSettingsOpen(true),
    },
    {
      key: 'logout',
      label: <span className="dial-small-text">{t(AuthI18nKeys.LogOut)}</span>,
      icon: <IconLogout size={DIAL_ICON_SIZE.SM} aria-hidden />,
      onClick: () => setIsLogoutOpen(true),
    },
  ];

  return (
    <>
      <div className="flex size-[60px] items-center justify-center">
        <DialDropdown
          placement="top-end"
          matchReferenceWidth={false}
          items={menuItems}
        >
          <button
            className="flex size-[44px] items-center justify-center rounded-full border border-transparent focus-within:border-focus hover:bg-accent-primary-alpha focus:border-transparent"
            aria-label={t(AuthI18nKeys.SignedInAs, { email })}
          >
            <DialTooltip tooltip={email} hideTooltip={isMobile}>
              {avatar}
            </DialTooltip>
          </button>
        </DialDropdown>
      </div>
      <SettingsModal
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
      <LogoutConfirmationModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />
    </>
  );
});

export default memo(UserMenu);
