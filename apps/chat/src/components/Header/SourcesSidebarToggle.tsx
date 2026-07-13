import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconFileDescription } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatch } from 'react-router-dom';
import { SidebarI18nKeys } from '../../constants/translation-keys';
import { useSourcesSidebar } from '../../context/SourcesSidebarContext';
import { ROUTES } from '../../types/routes';

const SourcesSidebarToggle: FC = () => {
  const { t } = useTranslation();
  const isConversationRoute = !!useMatch(`${ROUTES.Conversations}/*`);
  const { isOpen, handleOpen } = useSourcesSidebar();

  if (!isConversationRoute || isOpen) {
    return null;
  }

  return (
    <DialGhostIconButton
      icon={<IconFileDescription size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
      aria-label={t(SidebarI18nKeys.ToggleOpen)}
      aria-pressed={isOpen}
      tooltipProps={{ tooltip: t(SidebarI18nKeys.ToggleOpen) }}
      onClick={handleOpen}
    />
  );
};

export default memo(SourcesSidebarToggle);
