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
}

const EMPTY_CONVERSATIONS: never[] = [];

const ConversationPanelView: FC<Props> = ({
  isOpen,
  activeConversationId,
  onClose,
  onSelectConversation,
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
      formatDate={(iso) => new Date(iso).toLocaleDateString()}
      onBackdropClick={isMobile ? onClose : undefined}
      className={isMobile ? 'fixed inset-y-0 left-0 z-50 w-[288px]' : undefined}
    />
  );
};

export default ConversationPanelView;
