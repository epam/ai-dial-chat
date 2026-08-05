import { OverlayFeature } from '@epam/ai-dial-chat-overlay';
import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import { IconUser } from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { NAVIGATION_CONFIG } from '../../constants/navigation';
import { NavigationI18nKeys } from '../../constants/translation-keys';
import { useAppConfig } from '../../context/AppConfigContext';
import { useSheetNavigation } from '../../hooks/useSheetNavigation';
import { useUiFeature } from '../../hooks/useUiFeature';
import { ROUTES } from '../../types/routes';
import { UserConfigStatus } from '../../types/user-config-status';
import FooterMessage from '../FooterMessage/FooterMessage';
import styles from './MobileNavBottomSheet.module.scss';
import ProfilePageContent from './ProfilePageContent';

interface Props {
  onLogoutRequest: () => void;
}

const NavPageContent: FC<Props> = ({ onLogoutRequest }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { push, close } = useSheetNavigation();
  const { status, features } = useAppConfig();
  const isCatalogEnabled = useUiFeature(OverlayFeature.Catalog);

  const visibleNavItems = NAVIGATION_CONFIG.filter(
    ({ path, featureFlag }) =>
      (path !== ROUTES.Catalog || isCatalogEnabled) &&
      (featureFlag == null ||
        (status === UserConfigStatus.Ready && features[featureFlag] === true)),
  );

  const handleNavItem = (path: string) => {
    close();
    navigate(path);
  };

  const handleProfile = () => {
    push({
      title: t(NavigationI18nKeys.Profile),
      content: <ProfilePageContent onLogoutRequest={onLogoutRequest} />,
    });
  };

  return (
    <>
      <ul className="flex flex-col pb-4">
        {visibleNavItems.map(({ path, icon: Icon, labelKey }) => (
          <li key={path}>
            <button
              type="button"
              className={mergeClasses(
                styles.item,
                'flex w-full items-center gap-3 px-4 py-[10px] text-start',
              )}
              onClick={() => handleNavItem(path)}
            >
              <span className={styles.itemIcon}>
                <Icon size={BASE_ICON_SIZE} stroke={1.5} aria-hidden />
              </span>
              <span className="dial-small-text">{t(labelKey)}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className={mergeClasses(
              styles.item,
              'flex w-full items-center gap-3 px-4 py-[10px] text-start',
            )}
            onClick={handleProfile}
          >
            <span className={styles.itemIcon}>
              <IconUser size={BASE_ICON_SIZE} stroke={1.5} aria-hidden />
            </span>
            <span className="dial-small-text">
              {t(NavigationI18nKeys.Profile)}
            </span>
          </button>
        </li>
      </ul>
      <FooterMessage />
    </>
  );
};

export default memo(NavPageContent);
