import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ElementSize,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconChartBar } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { BasicI18nKeys } from '../../constants/translation-keys';
import { ROUTES } from '../../types/routes';

/**
 * Footer link of the navigation sidebar to the standalone Usage page. A router
 * link around an icon button, so middle-click and "open in new tab" keep
 * working. The link carries the accessible name and the focus; the button
 * inside only draws the icon and the tooltip, so it is hidden from assistive
 * tech and out of the tab order.
 */
const UsageLink: FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(ROUTES.Usage);
  const label = t(BasicI18nKeys.Usage);

  return (
    <Link
      to={ROUTES.Usage}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={mergeClasses(
        'rounded-full outline-offset-2 focus-visible:outline focus-visible:outline-1',
      )}
    >
      <GhostIconButton
        icon={
          /* The colour sits on the glyph's own box: the kit's icon button
             paints its icon secondary, and accent on hover. */
          <span className={isActive ? 'text-accent' : 'text-primary'}>
            <IconChartBar
              size={DIAL_ICON_SIZE.LG}
              stroke={DIAL_KIT_ICON_STROKE}
              aria-hidden
            />
          </span>
        }
        size={ElementSize.Large}
        aria-label={label}
        aria-hidden
        tooltipProps={{ tooltip: label }}
        tabIndex={-1}
        className={mergeClasses(
          '!size-10 !min-h-0 !min-w-0 !rounded-full !p-2',
          isActive && 'bg-control-accent-alpha-active',
        )}
      />
    </Link>
  );
};

export default memo(UsageLink);
