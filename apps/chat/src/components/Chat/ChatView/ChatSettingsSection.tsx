import { FC } from 'react';

import classNames from 'classnames';

import { Conversation, ConversationsTemporarySettings } from '@/src/types/chat';
import { DialAIEntityAddon } from '@/src/types/models';
import { Prompt } from '@/src/types/prompt';

import { ChatSettings } from './ChatSettings';

interface ChatSettingsSectionProps {
  selectedConversations: Conversation[];
  prompts: Prompt[];
  addons: DialAIEntityAddon[];
  onChangeSettings: (
    conversation: Conversation,
    args: ConversationsTemporarySettings,
  ) => void;
  onApplySettings: () => void;
  onClose: () => void;
  isCompareMode: boolean;
  showChatSettings: boolean;
}

export const ChatSettingsSection: FC<ChatSettingsSectionProps> = ({
  selectedConversations,
  prompts,
  addons,
  onChangeSettings,
  onApplySettings,
  onClose,
  isCompareMode,
  showChatSettings,
}) => {
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
