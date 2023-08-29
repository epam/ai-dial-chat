import { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isMobile } from '@/utils/app/mobile';

import { Conversation } from '@/types/chat';

import { useAppSelector } from '@/store/hooks';
import { ModelsSelectors } from '@/store/models/models.reducers';

import HomeContext from '@/pages/api/home/home.context';

import { ModelIcon } from '../Chatbar/components/ModelIcon';

import { Combobox } from '../Common/Combobox';

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
  const { t } = useTranslation('chat');
  const {
    state: { lightMode },
  } = useContext(HomeContext);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const defaultModelId = useAppSelector(ModelsSelectors.selectDefaultModelId);

  const [comparableConversations, setComparableConversations] = useState<
    Conversation[]
  >([]);

  useEffect(() => {
    if (selectedConversations.length === 1) {
      const selectedConversation = selectedConversations[0];

      const comparableConversations = conversations.filter((conv) => {
        if (conv.id === selectedConversation.id) {
          return false;
        }
        const convUserMessages = conv.messages.filter(
          (message) => message.role === 'user',
        );
        const selectedConvUserMessages = selectedConversation.messages.filter(
          (message) => message.role === 'user',
        );

        if (convUserMessages.length !== selectedConvUserMessages.length) {
          return false;
        }

        let isNotSame = false;
        for (let i = 0; i < convUserMessages.length; i++) {
          if (
            convUserMessages[i].content !== selectedConvUserMessages[i].content
          ) {
            isNotSame = true;
          }
          break;
        }

        if (isNotSame) {
          return false;
        }

        return true;
      });
      setComparableConversations(comparableConversations);
    }
  }, [conversations, selectedConversations]);

  const Option = (item: Conversation) => {
    const model =
      modelsMap[item.model?.id] ||
      (defaultModelId && modelsMap[defaultModelId]);

    if (!model) {
      return <></>;
    }

    return (
      <div className="flex items-center gap-3 pl-1">
        <ModelIcon
          entity={model}
          entityId={model.id}
          size={24}
          inverted={lightMode === 'dark'}
        />
        <span>{item.name}</span>
      </div>
    );
  };

  return (
    <div className="flex grow flex-col items-center justify-center p-5 py-2">
      <div className="flex max-w-[465px] flex-col gap-3 rounded bg-gray-200 p-6 dark:bg-gray-800">
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
