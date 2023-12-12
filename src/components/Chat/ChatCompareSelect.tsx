import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isMobile } from '@/src/utils/app/mobile';

import { Conversation, Role } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { Combobox } from '../Common/Combobox';

interface OptionProps {
  item: Conversation;
}

const Option = ({ item }: OptionProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const defaultModelId = useAppSelector(SettingsSelectors.selectDefaultModelId);
  const theme = useAppSelector(UISelectors.selectThemeState);

  const model = useMemo(
    () =>
      modelsMap[item.model?.id] ||
      (defaultModelId && modelsMap[defaultModelId]),
    [defaultModelId, item.model?.id, modelsMap],
  );

  if (!model) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 pl-1">
      <ModelIcon
        entity={model}
        entityId={model.id}
        size={24}
        inverted={theme === 'dark'}
      />
      <span>{item.name}</span>
    </div>
  );
};

interface Props {
  conversations: Conversation[];
  selectedConversations: Conversation[];
  onConversationSelect: (conversation: Conversation) => void;
}

export const ChatCompareSelect = ({
  conversations,
  selectedConversations,
  onConversationSelect,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const [comparableConversations, setComparableConversations] = useState<
    Conversation[]
  >([]);

  useEffect(() => {
    if (selectedConversations.length === 1) {
      const selectedConversation = selectedConversations[0];

      const comparableConversations = conversations
        .filter((conv) => !conv.replay.isReplay)
        .filter((conv) => {
          if (conv.id === selectedConversation.id) {
            return false;
          }
          const convUserMessages = conv.messages.filter(
            (message) => message.role === Role.User,
          );
          const selectedConvUserMessages = selectedConversation.messages.filter(
            (message) => message.role === Role.User,
          );

          if (convUserMessages.length !== selectedConvUserMessages.length) {
            return false;
          }

          return selectedConvUserMessages.every(
            (message, index) =>
              message.content === convUserMessages[index].content,
          );
        });
      setComparableConversations(comparableConversations);
    }
  }, [conversations, selectedConversations]);

  return (
    <div
      className="flex grow flex-col items-center justify-center p-5 py-2"
      data-qa="conversation-to-compare"
    >
      <div className="bg-gray-200 flex max-w-[465px] flex-col gap-3 rounded p-6">
        <div className="flex flex-col gap-2 text-center">
          <h5 className="text-base font-semibold">
            {t('Select conversation to compare with')}
          </h5>
          <span className="text-gray-500">
            (
            {t(
              'Note: only conversations with same user messages can be compared',
            )}
            )
          </span>
        </div>
        {comparableConversations && (
          <Combobox
            items={comparableConversations}
            getItemLabel={(conversation: Conversation) => conversation.name}
            getItemValue={(conversation: Conversation) => conversation.id}
            itemRow={Option}
            placeholder={
              (comparableConversations?.length > 0
                ? t('Select conversation')
                : t('No conversations available')) as string
            }
            disabled={!comparableConversations?.length || isMobile()}
            notFoundPlaceholder={t('No conversations available') || ''}
            onSelectItem={(itemID: string) => {
              const selectedConversation = comparableConversations.filter(
                (conv) => conv.id === itemID,
              )[0];
              if (selectedConversation) {
                onConversationSelect(selectedConversation);
              }
            }}
          />
        )}
      </div>
    </div>
  );
};
