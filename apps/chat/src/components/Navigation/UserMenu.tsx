import { SendOnEnter } from '@epam/ai-dial-conversation-input';
import {
  DIAL_ICON_SIZE,
  DialDropdown,
  DialEllipsisTooltip,
  DialTooltip,
  DropdownItem,
  DropdownItemType,
} from '@epam/ai-dial-ui-kit';
import {
  IconColorSwatch,
  IconDeviceDesktop,
  IconKeyboard,
  IconLanguage,
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
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import {
  metaKey,
  useKeyboardShortcutPreference,
} from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import {
  SUPPORTED_LANGUAGES,
  useLanguage,
} from '../../hooks/language/useLanguage';
import { ThemeId } from '../../types/theme-id';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';
import AvatarInitials from './AvatarInitials';
import MenuItemLabel from './MenuItemLabel';

export const UserMenu = memo(() => {
  const { status, user } = useUser();
  const { t } = useTranslation();
  const { selectedTheme, setTheme, themes } = useTheme();
  const { preference, setPreference } = useKeyboardShortcutPreference();
  const { language, changeLanguage } = useLanguage();

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
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      className="rounded-full"
      src={image}
      width={28}
      height={28}
      alt="User avatar"
      onError={() => setIsFallbackIconShown(true)}
    />
  );

  const hasDark = themes?.some((t) => t.id === ThemeId.Dark) ?? false;
  const hasLight = themes?.some((t) => t.id === ThemeId.Light) ?? false;

  const themeChildren = [
    hasDark && {
      key: 'theme-dark',
      label: (
        <MenuItemLabel
          label={t(SettingsI18nKeys.ThemeDark)}
          isActive={selectedTheme === ThemeId.Dark}
          icon={<IconMoon size={DIAL_ICON_SIZE.SM} aria-hidden />}
        />
      ),
      onClick: () => setTheme(ThemeId.Dark),
    },
    hasLight && {
      key: 'theme-light',
      label: (
        <MenuItemLabel
          label={t(SettingsI18nKeys.ThemeLight)}
          isActive={selectedTheme === ThemeId.Light}
          icon={<IconSun size={DIAL_ICON_SIZE.SM} aria-hidden />}
        />
      ),
      onClick: () => setTheme(ThemeId.Light),
    },
    hasDark &&
      hasLight && {
        key: 'theme-system',
        label: (
          <MenuItemLabel
            label={t(SettingsI18nKeys.ThemeSystem)}
            isActive={selectedTheme === ThemeId.System}
            icon={<IconDeviceDesktop size={DIAL_ICON_SIZE.SM} aria-hidden />}
          />
        ),
        onClick: () => setTheme(ThemeId.System),
      },
  ].filter((x): x is Exclude<typeof x, false> => Boolean(x)) as DropdownItem[];

  const languageChildren = SUPPORTED_LANGUAGES.map(({ code, nativeName }) => ({
    key: `language-${code}`,
    label: (
      <MenuItemLabel label={nativeName} isActive={language.startsWith(code)} />
    ),
    onClick: () => changeLanguage(code),
  }));

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
    ...(SUPPORTED_LANGUAGES.length > 1
      ? [
          {
            key: 'language',
            label: (
              <span className="dial-small-text">
                {t(SettingsI18nKeys.Language)}
              </span>
            ),
            icon: <IconLanguage size={DIAL_ICON_SIZE.SM} aria-hidden />,
            children: languageChildren,
          },
        ]
      : []),
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
            <MenuItemLabel
              label={t(SettingsI18nKeys.ShortcutEnter)}
              isActive={preference === SendOnEnter.Enter}
            />
          ),
          onClick: () => setPreference(SendOnEnter.Enter),
        },
        {
          key: 'shortcut-meta-enter',
          label: (
            <MenuItemLabel
              label={t(SettingsI18nKeys.ShortcutMetaEnter, {
                modifier: metaKey,
              })}
              isActive={preference === SendOnEnter.MetaEnter}
            />
          ),
          onClick: () => setPreference(SendOnEnter.MetaEnter),
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
