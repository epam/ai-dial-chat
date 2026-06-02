import { ConversationPanel } from '@epam/ai-dial-conversation-panel';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ConversationHistoryI18nKeys } from '../../constants/translation-keys.js';
import { useIsMobile } from '../../hooks/breakpoint/useBreakpoint.js';

interface Props {
  isOpen: boolean;
  activeConversationId?: string;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

const EMPTY_CONVERSATIONS: never[] = [];

const ConversationPanelView: FC<Props> = ({
  isOpen,
  activeConversationId,
  onClose,
  onSelectConversation,
  onNewChat,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <ConversationPanel
      conversations={EMPTY_CONVERSATIONS}
      isOpen={isOpen}
      onSelectConversation={onSelectConversation}
      activeConversationId={activeConversationId}
      title={t(ConversationHistoryI18nKeys.Title)}
      emptyLabel={t(ConversationHistoryI18nKeys.Empty)}
      onNewChat={onNewChat}
      newChatLabel={t(ConversationHistoryI18nKeys.NewChat)}
      searchPlaceholder={t(ConversationHistoryI18nKeys.SearchPlaceholder)}
      filterLabels={{
        all: t(ConversationHistoryI18nKeys.FilterAll),
        myChats: t(ConversationHistoryI18nKeys.FilterMyChats),
        shared: t(ConversationHistoryI18nKeys.FilterShared),
        organization: t(ConversationHistoryI18nKeys.FilterOrganization),
      }}
      groupLabels={{
        pinned: t(ConversationHistoryI18nKeys.PinnedSection),
        myChats: t(ConversationHistoryI18nKeys.MyChatsSection),
      }}
      onBackdropClick={isMobile ? onClose : undefined}
      className={isMobile ? 'fixed inset-y-0 left-0 z-50 w-[288px]' : undefined}
    />
  );
};

export default ConversationPanelView;
