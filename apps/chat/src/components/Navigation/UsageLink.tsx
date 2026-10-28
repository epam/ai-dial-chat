import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  Tooltip,
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
 * link, so middle-click and "open in new tab" keep working, drawn as an icon
 * button; no control is nested inside it. The tooltip is anchored to the link,
 * so keyboard focus shows it too.
 */
interface Props {
  /** Called when the link is activated, even when it points at the page on screen. */
  onClick?: () => void;
}

const UsageLink: FC<Props> = ({ onClick }) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isActive = pathname.startsWith(ROUTES.Usage);
  const label = t(BasicI18nKeys.Usage);

  return (
    <Tooltip tooltip={label} asChild>
      <Link
        to={ROUTES.Usage}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        onClick={onClick}
        className={mergeClasses(
          'flex size-10 shrink-0 items-center justify-center rounded-full p-2 outline-offset-2 hover:bg-control-accent-alpha-hover focus-visible:bg-control-accent-alpha-hover focus-visible:outline-1',
          isActive
            ? 'bg-control-accent-alpha-active text-accent'
            : 'text-primary',
        )}
      >
        <IconChartBar
          size={DIAL_ICON_SIZE.LG}
          stroke={DIAL_KIT_ICON_STROKE}
          aria-hidden
        />
      </Link>
    </Tooltip>
  );
};

export default memo(UsageLink);
