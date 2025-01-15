import React, { useCallback } from 'react';

import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { PublicVersionOption } from '@/src/types/publication';

import { ConversationRow } from '../Common/ReplaceConfirmationModal/Components';
import { PublicVersionSelector } from './Publish/PublicVersionSelector';

import { ConversationInfo } from '@epam/ai-dial-shared';

interface ConversationCompareItemProps {
  conv: ConversationInfo;
  comparableConversations: ConversationInfo[];
  selectedConversation?: Conversation;
  conversations: ConversationInfo[];
  onConversationSelect: (conversation: ConversationInfo) => void;
}

export function ConversationCompareItem({
  conv,
  comparableConversations,
  selectedConversation,
  conversations,
  onConversationSelect,
}: ConversationCompareItemProps) {
  const handleConversationSelect = useCallback(() => {
    const selectedConversation = comparableConversations.find(
      (comparableConversation) => conv.id === comparableConversation.id,
    );

    if (selectedConversation) {
      onConversationSelect(selectedConversation);
    }
  }, [comparableConversations, conv.id, onConversationSelect]);

  const handleVersionChange = useCallback(
    (_: string, newVersion: PublicVersionOption) => {
      const selectedConversation = conversations.find(
        (conv) => conv.id === newVersion.id,
      );

      if (selectedConversation) {
        onConversationSelect(selectedConversation);
      }
    },
    [conversations, onConversationSelect],
  );

  return (
    <div
      key={conv.id}
      className="flex cursor-pointer items-center justify-between gap-4 rounded pr-[14px] hover:bg-accent-primary-alpha"
      data-qa="conversation-row"
      onClick={handleConversationSelect}
    >
      <div className="w-full truncate">
        <ConversationRow
          featureContainerClassNames="!w-full"
          itemComponentClassNames="group hover:bg-transparent !pl-3 !h-[34px]"
          item={conv}
        />
      </div>

      {conv.publicationInfo?.version && (
        <PublicVersionSelector
          btnClassNames="cursor-pointer h-[34px] flex items-center"
          publicVersionGroupId={getPublicItemIdWithoutVersion(
            conv.publicationInfo.version,
            conv.id,
          )}
          excludeEntityId={selectedConversation?.id}
          onChangeSelectedVersion={handleVersionChange}
        />
      )}
    </div>
  );
}
