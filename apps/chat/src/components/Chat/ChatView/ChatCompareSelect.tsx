import { IconCheck } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isValidConversationForCompare } from '@/src/utils/app/conversation';
import { sortByName } from '@/src/utils/app/folders';
import { isMobile } from '@/src/utils/app/mobile';

import { ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import { StoreSelectorsHook } from '@/src/store/useStoreSelectors';

import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { Combobox } from '@/src/components/Common/Combobox';
import Loader from '@/src/components/Common/Loader';
import ShareIcon from '@/src/components/Common/ShareIcon';

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
  useStoreSelectors: StoreSelectorsHook;
  // conversations: ConversationInfo[];
  // selectedConversations: Conversation[];
  onConversationSelect: (conversation: ConversationInfo) => void;
}

export const ChatCompareSelect = ({
  useStoreSelectors,
  onConversationSelect,
}: Props) => {
  const { useConversationsSelectors } = useStoreSelectors();
  const { conversations, selectedConversations, isCompareLoading } =
    useConversationsSelectors([
      'selectConversations',
      'selectSelectedConversations',
      'selectIsCompareLoading',
    ]);
  const { t } = useTranslation(Translation.Chat);
  const [showAll, setShowAll] = useState(false);

  const handleChangeShowAll = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setShowAll(e.target.checked);
    },
    [],
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
      {isCompareLoading && (
        <Loader
          dataQa="compare-loader"
          containerClassName="absolute bg-blackout h-full"
        />
      )}
    </div>
  );
};
