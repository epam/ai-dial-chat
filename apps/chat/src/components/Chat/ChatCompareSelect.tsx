import { IconCheck } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isValidConversationForCompare } from '@/src/utils/app/conversation';
import { sortByName } from '@/src/utils/app/folders';
import { isMobile } from '@/src/utils/app/mobile';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';

import { ModelIcon } from '../Chatbar/ModelIcon';
import { Combobox } from '../Common/Combobox';
import Loader from '../Common/Loader';
import ShareIcon from '../Common/ShareIcon';

interface OptionProps {
  item: ConversationInfo;
}

const Option = ({ item }: OptionProps) => {
  const model = useAppSelector((state) =>
    ModelsSelectors.selectModel(state, item.model.id),
  );

  return (
    <div className="group flex items-center gap-3 truncate pl-1">
      <ShareIcon {...item} isHighlighted={false} featureType={FeatureType.Chat}>
        <ModelIcon entity={model} entityId={item.model.id} size={18} />
      </ShareIcon>
      <span className="truncate whitespace-pre">{item.name}</span>
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
  const [showAll, setShowAll] = useState(false);

  const handleChangeShowAll = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setShowAll(e.target.checked);
    },
    [],
  );

  const isLoading = !!useAppSelector(
    ConversationsSelectors.selectIsCompareLoading,
  );

  const [comparableConversations, setComparableConversations] = useState<
    ConversationInfo[]
  >([]);

  useEffect(() => {
    if (selectedConversations.length === 1) {
      const selectedConversation = selectedConversations[0];

      const comparableConversations = conversations.filter((conv) =>
        isValidConversationForCompare(selectedConversation, conv, showAll),
      );
      setComparableConversations(sortByName(comparableConversations));
    }
  }, [conversations, selectedConversations, showAll]);

  return (
    <div
      className="relative flex grow flex-col items-center justify-center p-5 py-2"
      data-qa="conversation-to-compare"
    >
      <div className="flex max-w-[465px] flex-col gap-3 rounded bg-layer-2 p-6 ">
        <div className="flex flex-col gap-2">
          <h5 className="text-base font-semibold">
            {t('Select conversation to compare with')}
          </h5>
          <span className="text-secondary">
            (
            {t(
              'Only conversations containing the same number of messages can be compared.',
            )}
            )
          </span>
        </div>
        <div className="relative flex items-center">
          <input
            name="showAllCheckbox"
            checked={showAll}
            onChange={handleChangeShowAll}
            title=""
            type="checkbox"
            className="checkbox peer"
          />
          <IconCheck
            size={16}
            className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
          />
          <label className="" htmlFor="showAllCheckbox">
            {t('Show all conversations')}
          </label>
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
      {isLoading && (
        <Loader
          dataQa="compare-loader"
          containerClassName="absolute bg-blackout h-full"
        />
      )}
    </div>
  );
};
