/* eslint-disable @typescript-eslint/ban-ts-comment */
import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
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
  IconDeviceDesktop,
  IconKeyboard,
  IconLanguage,
  IconLogout,
  IconMoon,
  IconSun,
} from '@tabler/icons-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AuthI18nKeys,
  ButtonsI18nKeys,
  SettingsI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint';
import {
  metaKey,
  useKeyboardShortcutPreference,
} from '../../hooks/keyboard-shortcut/useKeyboardShortcutPreference';
import {
  SUPPORTED_LANGUAGES,
  useLanguage,
} from '../../hooks/language/useLanguage';
import { useLogout } from '../../hooks/logout/useLogout';
import { useThemeOptions } from '../../hooks/theme/useThemeOptions';
import { useUserProfile } from '../../hooks/user-profile/useUserProfile';
import { useUiFeature } from '../../hooks/useUiFeature';
import { AuthStatus } from '../../types/auth-status';
import { ThemeId } from '../../types/theme-id';
import LogoutConfirmationModal from '../LogoutConfirmation/LogoutConfirmationModal';
import AvatarInitials from './AvatarInitials';
import MenuItemLabel from './MenuItemLabel';

export const UserMenu = memo(() => {
  const { status, user } = useUser();
  const { t } = useTranslation();
  const { hasDark, hasLight, selectedTheme, setTheme } = useThemeOptions();
  const { preference, setPreference } = useKeyboardShortcutPreference();
  const { language, changeLanguage } = useLanguage();
  const {
    email,
    displayName,
    shortName,
    image,
    isFallbackIconShown,
    setIsFallbackIconShown,
  } = useUserProfile();
  const isMobile = useIsMobile();
  const { isLogoutOpen, openLogout, closeLogout } = useLogout();
  const isUserSettingsHidden = useUiFeature(OverlayFeature.HideUserSettings);

  if (status !== AuthStatus.Authenticated || !user || isMobile) {
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
      alt={t(AuthI18nKeys.UserAvatar)}
      onError={() => setIsFallbackIconShown(true)}
    />
  );

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        <div className="flex h-[40px] min-w-0 items-center gap-3">
          <AvatarInitials shortName={shortName} />
          <DialEllipsisTooltip
            text={displayName}
            className="dial-small-text min-w-0 flex-1 truncate text-primary"
          />
        </div>
      ),
    },
    ...(!isUserSettingsHidden && SUPPORTED_LANGUAGES.length > 1
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
    // TODO: for today we support only light theme
    // {
    //   key: 'theme',
    //   label: (
    //     <span className="dial-small-text">{t(SettingsI18nKeys.Theme)}</span>
    //   ),
    //   icon: <IconColorSwatch size={DIAL_ICON_SIZE.SM} aria-hidden />,
    //   children: themeChildren,
    // },
    ...(!isUserSettingsHidden
      ? [
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
        ]
      : []),
    { key: 'divider-1', type: DropdownItemType.Divider },
    {
      key: 'logout',
      label: (
        <span className="dial-small-text">{t(ButtonsI18nKeys.LogOut)}</span>
      ),
      icon: <IconLogout size={DIAL_ICON_SIZE.SM} aria-hidden />,
      onClick: openLogout,
    },
  ];

  return (
    <>
      <div className="flex size-[60px] items-center justify-center">
        <DialDropdown
          placement="top-end"
          matchReferenceWidth={false}
          items={menuItems}
          listClassName="cp-dropdown-overlay"
        >
          <button
            className="flex size-[44px] items-center justify-center rounded-full border border-transparent hover:bg-control-accent-alpha-hover focus-visible:outline focus-visible:-outline-offset-1 focus-visible:outline-focus-black"
            aria-label={t(AuthI18nKeys.SignedInAs, { email })}
          >
            <DialTooltip tooltip={email} hideTooltip={isMobile}>
              {avatar}
            </DialTooltip>
          </button>
        </DialDropdown>
      </div>
      <LogoutConfirmationModal isOpen={isLogoutOpen} onClose={closeLogout} />
    </>
  );
});

export default memo(UserMenu);
