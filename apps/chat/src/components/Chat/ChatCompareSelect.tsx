import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isMobile } from '@/src/utils/app/mobile';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { isValidConversationForCompare } from '@/src/utils/app/conversation';
import { ModelIcon } from '../Chatbar/ModelIcon';
import { Combobox } from '../Common/Combobox';
import ShareIcon from '../Common/ShareIcon';
import { compareEntitiesByName } from '@/src/utils/app/folders';

interface OptionProps {
  item: ConversationInfo;
}

const Option = ({ item }: OptionProps) => {
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const defaultModelId = useAppSelector(SettingsSelectors.selectDefaultModelId);

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
    <div className="group flex items-center gap-3 pl-1">
      <ShareIcon {...item} isHighlighted={false} featureType={FeatureType.Chat}>
        <ModelIcon entity={model} entityId={model.id} size={24} />
      </ShareIcon>
      <span>{item.name}</span>
    </div>
  );
};

interface Props {
  conversations: ConversationInfo[];
  selectedConversations: Conversation[];
  onConversationSelect: (conversation: ConversationInfo) => void;
}

export const ChatCompareSelect = ({
  conversations,
  selectedConversations,
  onConversationSelect,
}: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const [comparableConversations, setComparableConversations] = useState<
    ConversationInfo[]
  >([]);

  useEffect(()=> { //TODO: check if already uploaded
    dispatch(ConversationsActions.uploadConversationsWithFoldersRecursive())
  },[dispatch])

  useEffect(() => {
    if (selectedConversations.length === 1) {
      const selectedConversation = selectedConversations[0];

      const comparableConversations = conversations
        .filter((conv) => isValidConversationForCompare(selectedConversation, conv));
      setComparableConversations(comparableConversations.sort(compareEntitiesByName));
    }
  }, [conversations, selectedConversations]);

  return (
    <div
      className="flex grow flex-col items-center justify-center p-5 py-2"
      data-qa="conversation-to-compare"
    >
      <div className="flex max-w-[465px] flex-col gap-3 rounded bg-layer-2 p-6">
        <div className="flex flex-col gap-2 text-center">
          <h5 className="text-base font-semibold">
            {t('Select conversation to compare with')}
          </h5>
          <span className="text-secondary">
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
            getItemLabel={(conversation: ConversationInfo) => conversation.name}
            getItemValue={(conversation: ConversationInfo) => conversation.id}
            itemRow={Option}
            placeholder={
              (comparableConversations?.length > 0
                ? t('Select conversation')
                : t('No conversations available')) as string
            }
            disabled={!comparableConversations?.length || isMobile()}
            notFoundPlaceholder={t('No conversations available') || ''}
            onSelectItem={(itemID: string) => {
              const selectedConversation = comparableConversations.find(
                (conv) => conv.id === itemID,
              );
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
