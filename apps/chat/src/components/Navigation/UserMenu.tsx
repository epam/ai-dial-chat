import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialEllipsisTooltip,
  DialTooltip,
  DropdownItemType,
} from '@epam/ai-dial-ui-kit';
import {
  IconCheck,
  IconColorSwatch,
  IconDeviceDesktop,
  IconKeyboard,
  IconLogout,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthI18nKeys,
  SettingsI18nKeys,
} from '../../constants/translation-keys';
import { StorageKey, ThemeId } from '../../constants/storage';
import { useUser } from '../../context/auth/UserContext';
import { getFromLocalStorage } from '../../utils/local-storage';
import { useTheme } from '../../context/ThemeContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import {
  metaKey,
  useKeyboardShortcutPreference,
} from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';
import AvatarInitials from './AvatarInitials';

export const UserMenu = memo(() => {
  const { status, user } = useUser();
  const { t } = useTranslation();
  const { currentTheme, setTheme, themes } = useTheme();
  const { preference, setPreference } = useKeyboardShortcutPreference();

  const image = user?.claims?.['image'] as string | undefined;
  const [isFallbackIconShown, setIsFallbackIconShown] = useState(!image);
  const isMobile = useIsMobile();
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const email = (user?.claims?.['email'] as string) ?? user?.sub ?? '';
  const displayName = (user?.claims?.['name'] as string) || email;

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
    <AvatarInitials shortName={shortName} />
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

  const activeCheck = <IconCheck size={DIAL_ICON_SIZE.SM} aria-hidden />;

  const storedTheme = getFromLocalStorage(StorageKey.Theme) ?? currentTheme;

  const hasDark = themes?.some((t) => t.id === ThemeId.Dark) ?? false;
  const hasLight = themes?.some((t) => t.id === ThemeId.Light) ?? false;

  const themeChildren = [
    hasDark && {
      key: 'theme-dark',
      label: (
        <span className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <IconMoon size={DIAL_ICON_SIZE.SM} aria-hidden />
            <span className="dial-small-text">{t(SettingsI18nKeys.ThemeDark)}</span>
          </span>
          {storedTheme === ThemeId.Dark && activeCheck}
        </span>
      ),
      onClick: () => setTheme(ThemeId.Dark),
    },
    hasLight && {
      key: 'theme-light',
      label: (
        <span className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <IconSun size={DIAL_ICON_SIZE.SM} aria-hidden />
            <span className="dial-small-text">{t(SettingsI18nKeys.ThemeLight)}</span>
          </span>
          {storedTheme === ThemeId.Light && activeCheck}
        </span>
      ),
      onClick: () => setTheme(ThemeId.Light),
    },
    hasDark && hasLight && {
      key: 'theme-system',
      label: (
        <span className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2">
            <IconDeviceDesktop size={DIAL_ICON_SIZE.SM} aria-hidden />
            <span className="dial-small-text">{t(SettingsI18nKeys.ThemeSystem)}</span>
          </span>
          {storedTheme === ThemeId.System && activeCheck}
        </span>
      ),
      onClick: () => setTheme(ThemeId.System),
    },
  ].filter(Boolean);

  const menuItems = [
    {
      key: 'identity',
      type: DropdownItemType.PlainText,
      label: (
        <div className="flex min-w-0 items-center gap-4 px-2 py-1">
          <AvatarInitials shortName={shortName} />
          <DialEllipsisTooltip
            text={displayName}
            className="dial-small-text min-w-0 flex-1 truncate text-secondary"
          />
        </div>
      ),
    },
    { key: 'divider-1', type: DropdownItemType.Divider },
    {
      key: 'theme',
      label: (
        <span className="dial-small-text">{t(SettingsI18nKeys.Theme)}</span>
      ),
      icon: <IconColorSwatch size={DIAL_ICON_SIZE.SM} aria-hidden />,
      children: themeChildren,
    },
    {
      key: 'keyboard-shortcuts',
      label: (
        <span className="dial-small-text">
          {t(SettingsI18nKeys.KeyboardShortcuts)}
        </span>
      ),
      icon: <IconKeyboard size={DIAL_ICON_SIZE.SM} aria-hidden />,
      children: [
        {
          key: 'shortcut-enter',
          label: (
            <span className="flex items-center justify-between gap-4">
              <span className="dial-small-text">
                {t(SettingsI18nKeys.ShortcutEnter)}
              </span>
              {preference === 'enter' && activeCheck}
            </span>
          ),
          onClick: () => setPreference('enter'),
        },
        {
          key: 'shortcut-meta-enter',
          label: (
            <span className="flex items-center justify-between gap-4">
              <span className="dial-small-text">
                {t(SettingsI18nKeys.ShortcutMetaEnter, { modifier: metaKey })}
              </span>
              {preference === 'meta-enter' && activeCheck}
            </span>
          ),
          onClick: () => setPreference('meta-enter'),
        },
      ],
    },
    { key: 'divider-2', type: DropdownItemType.Divider },
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
          listClassName="shadow-md"
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
      <LogoutConfirmationModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
      />
    </>
  );
});

export default memo(UserMenu);
