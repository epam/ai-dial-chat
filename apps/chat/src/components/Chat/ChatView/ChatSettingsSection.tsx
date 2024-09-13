import { FC } from 'react';

import classNames from 'classnames';

import { Conversation, ConversationsTemporarySettings } from '@/src/types/chat';

import { CommonComponentSelectors } from '@/src/components/Chat/Chat';

import { ChatSettings } from './ChatSettings';

interface ChatSettingsSectionProps {
  useComponentSelectors: CommonComponentSelectors;
  // selectedConversations: Conversation[];
  // prompts: Prompt[];
  // addons: DialAIEntityAddon[];
  // isCompareMode: boolean;
  onChangeSettings: (
    conversation: Conversation,
    args: ConversationsTemporarySettings,
  ) => void;
  onApplySettings: () => void;
  onClose: () => void;
  showChatSettings: boolean;
}

export const ChatSettingsSection: FC<ChatSettingsSectionProps> = ({
  useComponentSelectors,
  onChangeSettings,
  onApplySettings,
  onClose,
  showChatSettings,
}) => {
  const { selectedConversations, prompts, addons, isCompareMode } =
    useComponentSelectors();
  return (
    <div
      className={classNames(
        'absolute left-0 top-0 grid size-full',
        selectedConversations.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
      )}
    >
      {selectedConversations.map((conv, index) => (
        <ChatSettings
          key={conv.id}
          conversation={conv}
          modelId={conv.model.id}
          prompts={prompts}
          addons={addons}
          onChangeSettings={(args) => onChangeSettings(conv, args)}
          onApplySettings={onApplySettings}
          onClose={onClose}
          isOpen={showChatSettings}
          isRight={index === 1}
          isCompareMode={isCompareMode}
        />
      ))}
    </div>
  );
};
