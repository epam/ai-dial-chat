import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE, DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';
import {
  IconChevronRight,
  IconKeyboard,
  IconLogout,
} from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  SettingsI18nKeys,
} from '../../constants/translation-keys';
import { useUserProfile } from '../../hooks/user-profile/useUserProfile';
import { useSheetNavigation } from '../../hooks/useSheetNavigation';
import AvatarInitials from '../Navigation/AvatarInitials';
import KeyboardPageContent from './KeyboardPageContent';
import styles from './MobileNavBottomSheet.module.scss';

interface Props {
  onLogoutRequest: () => void;
}

const ProfilePageContent: FC<Props> = ({ onLogoutRequest }) => {
  const { t } = useTranslation();
  const { push, close } = useSheetNavigation();
  const {
    displayName,
    shortName,
    image,
    isFallbackIconShown,
    setIsFallbackIconShown,
  } = useUserProfile();

  const handleKeyboard = () => {
    push({
      title: t(SettingsI18nKeys.KeyboardShortcuts),
      content: <KeyboardPageContent />,
    });
  };

  const handleLogout = () => {
    close();
    onLogoutRequest();
  };

  const avatar = isFallbackIconShown ? (
    <AvatarInitials shortName={shortName} />
  ) : (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <img
      className="rounded-full"
      src={image}
      width={28}
      height={28}
      alt=""
      onError={() => setIsFallbackIconShown(true)}
    />
  );

  return (
    <>
      {/* User identity */}
      <div className="flex h-[56px] items-center gap-3 px-4 py-2">
        {avatar}
        <DialEllipsisTooltip
          text={displayName}
          className="dial-small-text min-w-0 flex-1 truncate text-secondary"
        />
      </div>

      <ul className="flex flex-col">
        <li>
          <button
            type="button"
            className={mergeClasses(
              styles.item,
              'flex w-full items-center gap-3 px-4 py-[10px] text-start',
            )}
            onClick={handleKeyboard}
          >
            <IconKeyboard
              size={BASE_ICON_SIZE}
              stroke={1.5}
              aria-hidden
              className={styles.itemIcon}
            />
            <span className="dial-small-text flex-1">
              {t(SettingsI18nKeys.KeyboardShortcuts)}
            </span>
            <IconChevronRight
              size={BASE_ICON_SIZE}
              stroke={1.5}
              aria-hidden
              className={mergeClasses(styles.itemIcon, 'rtl:scale-x-[-1]')}
            />
          </button>
        </li>
      </ul>

      <hr className="border-secondary" />

      <ul className="flex flex-col pb-4">
        <li>
          <button
            type="button"
            className={mergeClasses(
              styles.item,
              'flex w-full items-center gap-3 px-4 py-[10px] text-start',
            )}
            onClick={handleLogout}
          >
            <IconLogout
              size={BASE_ICON_SIZE}
              stroke={1.5}
              aria-hidden
              className={styles.itemIcon}
            />
            <span className="dial-small-text">{t(ButtonsI18nKeys.LogOut)}</span>
          </button>
        </li>
      </ul>
    </>
  );
};

export default memo(ProfilePageContent);
