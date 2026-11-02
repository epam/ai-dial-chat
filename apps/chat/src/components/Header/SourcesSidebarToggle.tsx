import { useAttachmentCanvas } from '@epam/ai-dial-attachment-canvas';
import {
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  GhostIconButton,
} from '@epam/ai-dial-ui-kit';
import { IconFileDescription } from '@tabler/icons-react';
import { memo, useCallback, type ComponentType, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { isConversationPagePath } from '../../constants/routes';
import { SidebarI18nKeys } from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';

interface Props {
  /** Tabler icon drawn in the button. Defaults to the document glyph. */
  icon?: ComponentType<{ size?: number; stroke?: number; className?: string }>;
  /** Class applied to the icon, e.g. to mirror a directional glyph in RTL. */
  iconClassName?: string;
}

const SourcesSidebarToggle: FC<Props> = ({
  icon: Icon = IconFileDescription,
  iconClassName,
}) => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isConversationRoute = isConversationPagePath(pathname);
  const { isOpen, handleOpen } = useSourcesSidebar();
  const { closeCanvas } = useAttachmentCanvas();

  const handleClick = useCallback(() => {
    closeCanvas();
    handleOpen();
  }, [closeCanvas, handleOpen]);

  if (!isConversationRoute || isOpen) {
    return null;
  }

  return (
    <GhostIconButton
      icon={
        <Icon
          size={DIAL_ICON_SIZE.LG}
          stroke={DIAL_KIT_ICON_STROKE}
          className={iconClassName}
        />
      }
      aria-label={t(SidebarI18nKeys.ToggleOpen)}
      aria-pressed={isOpen}
      tooltipProps={{ tooltip: t(SidebarI18nKeys.ToggleOpen) }}
      onClick={handleClick}
    />
  );
};

export default memo(SourcesSidebarToggle);
