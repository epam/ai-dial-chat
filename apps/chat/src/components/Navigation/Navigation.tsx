import { DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { memo } from 'react';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { NAVIGATION_CONFIG } from '../../constants/navigation';
import { NavigationI18nKeys } from '../../constants/translation-keys';

const Navigation: FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      aria-label={t(NavigationI18nKeys.AriaLabel)}
      className="flex h-full w-[60px] flex-col justify-between bg-layer-3"
    >
      <div className="flex flex-col items-center gap-1 pt-2">
        {NAVIGATION_CONFIG.map(({ path, icon: Icon, labelKey }) => {
          const isActive =
            path === '/' ? pathname === '/' : pathname.startsWith(path);
          return (
            <DialGhostIconButton
              key={path}
              icon={<Icon size={20} stroke={1.5} />}
              aria-label={t(labelKey)}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigate(path)}
            />
          );
        })}
      </div>
      <div />
    </nav>
  );
};

export default memo(Navigation);
