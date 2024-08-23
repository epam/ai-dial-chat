import { IconCheck } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isValidConversationForCompare } from '@/src/utils/app/conversation';
import { sortByName } from '@/src/utils/app/folders';
import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { Conversation, ConversationInfo } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';

import Loader from '../Common/Loader';
import { ConversationRow } from '../Common/ReplaceConfirmationModal/Components';
import { VersionSelector } from './Publish/VersionSelector';

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
  const [comparableConversations, setComparableConversations] = useState<
    ConversationInfo[]
  >([]);

  const publicVersionGroups = useAppSelector(
    ConversationsSelectors.selectPublicVersionGroups,
  );
  const isLoading = !!useAppSelector(
    ConversationsSelectors.selectIsCompareLoading,
  );

  const handleChangeShowAll = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setShowAll(e.target.checked);
    },
    [],
  );

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
      <div className="flex max-w-[465px] flex-col gap-4 divide-y divide-tertiary rounded bg-layer-2 py-6">
        <div className="px-6">
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
          <div className="relative mt-4 flex items-center">
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
            <label htmlFor="showAllCheckbox">
              {t('Show all conversations')}
            </label>
          </div>
        </div>
        <div className="px-6 pt-4">
          <h6>{t('Conversations')}</h6>
          {comparableConversations.length ? (
            <ul className="mt-4">
              {comparableConversations.map((conv) => {
                const currentVersionGroupId = conv.publicationInfo?.version
                  ? getPublicItemIdWithoutVersion(
                      conv.publicationInfo.version,
                      conv.id,
                    )
                  : null;
                const currentVersionGroup = currentVersionGroupId
                  ? publicVersionGroups[currentVersionGroupId]
                  : null;

                if (
                  currentVersionGroup &&
                  conv.publicationInfo?.version !==
                    currentVersionGroup.selectedVersion.version
                ) {
                  return null;
                }

                return (
                  <div
                    key={conv.id}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded pr-[14px] hover:bg-accent-primary-alpha"
                  >
                    <div
                      className="truncate"
                      onClick={() => {
                        const selectedConversation =
                          comparableConversations.find(
                            (comparableConversation) =>
                              conv.id === comparableConversation.id,
                          );

                        if (selectedConversation) {
                          onConversationSelect(selectedConversation);
                        }
                      }}
                    >
                      <ConversationRow
                        featureContainerClassNames="!w-full"
                        itemComponentClassNames="hover:bg-transparent"
                        item={conv}
                      />
                    </div>

                    {conv.publicationInfo?.version && (
                      <VersionSelector
                        btnClassNames="cursor-pointer"
                        entity={conv}
                        featureType={FeatureType.Chat}
                        onChangeSelectedVersion={(_, newVersion) => {
                          const selectedConversation = conversations.find(
                            (conv) => conv.id === newVersion.id,
                          );

                          if (selectedConversation) {
                            onConversationSelect(selectedConversation);
                          }
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-secondary">
              {t('No conversations available')}
            </p>
          )}
        </div>
        {isLoading && (
          <Loader
            dataQa="compare-loader"
            containerClassName="absolute bg-blackout h-full"
          />
        )}
      </div>
    </div>
  );
};
