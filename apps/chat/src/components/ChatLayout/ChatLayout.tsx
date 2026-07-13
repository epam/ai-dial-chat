import { DIAL_ICON_SIZE, DialGhostIconButton } from '@epam/ai-dial-ui-kit';
import { IconLayoutSidebarRight, IconPlus } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router-dom';
import {
  ButtonsI18nKeys,
  ConversationPanelI18nKeys,
} from '../../constants/translation-keys';

interface Props {
  isHistoryPanelOpen: boolean;
  onToggleHistoryPanel: () => void;
  onNewChat: () => void;
}

const ChatLayout: FC<Props> = ({
  isHistoryPanelOpen,
  onToggleHistoryPanel,
  onNewChat,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="hidden h-16 shrink-0 items-center gap-2 px-2 desktop:flex">
        <DialGhostIconButton
          icon={
            <IconLayoutSidebarRight
              size={DIAL_ICON_SIZE.LG}
              stroke={1.5}
              className={'rtl:scale-x-[-1]'}
            />
          }
          aria-label={t(ConversationPanelI18nKeys.ToggleAriaLabel)}
          tooltipProps={{
            tooltip: t(ConversationPanelI18nKeys.ToggleAriaLabel),
          }}
          onClick={onToggleHistoryPanel}
        />
        {!isHistoryPanelOpen && (
          <DialGhostIconButton
            icon={<IconPlus size={DIAL_ICON_SIZE.LG} stroke={1.5} />}
            aria-label={t(ButtonsI18nKeys.NewChat)}
            tooltipProps={{ tooltip: t(ButtonsI18nKeys.NewChat) }}
            onClick={onNewChat}
            className="new-chat-rail-btn"
          />
        )}
      </div>
      <Outlet />
    </div>
  );
};

export default memo(ChatLayout);
