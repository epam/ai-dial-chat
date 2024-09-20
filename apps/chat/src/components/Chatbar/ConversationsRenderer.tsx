import { useEffect, useMemo, useState } from 'react';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import CollapsibleSection from '../Common/CollapsibleSection';
import { ConversationComponent } from './Conversation';

interface ConversationsRendererProps {
  conversations: Conversation[];
  label: string;
}

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

  const additionalConvData = useMemo(
    () => ({
      isSidePanelItem: true,
    }),
    [],
  );

  useEffect(() => {
    setIsSectionHighlighted(
      conversations.some((conv) => selectedConversationsIds.includes(conv.id)),
    );
  }, [selectedConversationsIds, conversations]);

  return (
    <>
      {conversations.length > 0 && (
        <CollapsibleSection
          name={label}
          onToggle={handleToggle}
          dataQa="chronology"
          isHighlighted={isSectionHighlighted}
          openByDefault={isExpanded}
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
      )}
    </>
  );
};
