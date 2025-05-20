import { useEffect, useState } from 'react';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';

import { ConversationComponent } from './Conversation';

interface ConversationsRendererProps {
  conversations: Conversation[];
  label: string;
}

const additionalConvData = {
  isSidePanelItem: true,
};

export const ConversationsRenderer = ({
  conversations,
  label,
}: ConversationsRendererProps) => {
  const selectedConversationsIds = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const [isSectionHighlighted, setIsSectionHighlighted] = useState(false);

  const { handleToggle, isExpanded } = useSectionToggle(
    label,
    FeatureType.Chat,
  );

  useEffect(() => {
    setIsSectionHighlighted(
      conversations.some((conv) => selectedConversationsIds.includes(conv.id)),
    );
  }, [selectedConversationsIds, conversations]);

  if (!conversations.length) {
    return null;
  }

  return (
    <CollapsibleSection
      name={label}
      onToggle={handleToggle}
      dataQa="chronology"
      isHighlighted={isSectionHighlighted}
      openByDefault={isExpanded}
      isExpanded={isExpanded}
    >
      <div className="flex flex-col gap-1 py-1">
        {conversations.map((conversation) => (
          <ConversationComponent
            key={conversation.id}
            item={conversation}
            additionalItemData={additionalConvData}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
};
