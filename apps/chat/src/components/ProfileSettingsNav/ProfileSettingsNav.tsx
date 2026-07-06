import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { BASE_ICON_SIZE } from '@epam/ai-dial-ui-kit';
import {
  IconAdjustmentsHorizontal,
  IconTable,
  IconUser,
} from '@tabler/icons-react';
import { type FC, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { SettingsI18nKeys } from '../../constants/translation-keys';
import { ROUTES } from '../../types/routes';

interface Props {
  className?: string;
}

/**
 * Left sub-navigation for account settings pages (General · Preferences · Usage).
 * General and Preferences have no page yet and render as inert rows; Usage links
 * to the real route and gets the active-state highlight when visited.
 */
const ProfileSettingsNav: FC<Props> = ({ className }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isUsageActive = pathname === ROUTES.ProfileUsage;

  const rowClassName =
    'flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 dial-small-text';

  return (
    <nav
      aria-label={t(SettingsI18nKeys.NavAriaLabel)}
      className={mergeClasses(
        'hidden w-[210px] shrink-0 flex-col border-e border-tertiary bg-layer-0 px-3 py-5 desktop:flex',
        className,
      )}
    >
      <div className="dial-tiny-semi-text px-2.5 pb-3 uppercase tracking-wider text-secondary">
        {t(SettingsI18nKeys.NavSectionLabel)}
      </div>

      <div
        aria-disabled="true"
        className={mergeClasses(rowClassName, 'cursor-default text-secondary')}
      >
        <IconUser size={BASE_ICON_SIZE} stroke={1.75} aria-hidden />
        {t(SettingsI18nKeys.General)}
      </div>

      <div
        aria-disabled="true"
        className={mergeClasses(rowClassName, 'cursor-default text-secondary')}
      >
        <IconAdjustmentsHorizontal
          size={BASE_ICON_SIZE}
          stroke={1.75}
          aria-hidden
        />
        {t(SettingsI18nKeys.Preferences)}
      </div>

      <Link
        to={ROUTES.ProfileUsage}
        aria-current={isUsageActive ? 'page' : undefined}
        className={mergeClasses(
          rowClassName,
          isUsageActive
            ? 'bg-accent-primary-alpha font-semibold text-accent-primary'
            : 'text-secondary hover:bg-layer-6',
        )}
      >
        <IconTable size={BASE_ICON_SIZE} stroke={1.75} aria-hidden />
        {t(SettingsI18nKeys.Usage)}
      </Link>
    </nav>
  );
};

export default memo(ProfileSettingsNav);
