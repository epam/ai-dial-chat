import { IconCheck } from '@tabler/icons-react';
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { isValidConversationForCompare } from '@/src/utils/app/conversation';
import { sortByName } from '@/src/utils/app/folders';
import { doesEntityContainSearchItem } from '@/src/utils/app/search';
import { getPublicItemIdWithoutVersion } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/publication/publication.reducers';

import Loader from '../Common/Loader';
import { ConversationRow } from '../Common/ReplaceConfirmationModal/Components';
import { PublicVersionSelector } from './Publish/PublicVersionSelector';

import { ConversationInfo } from '@epam/ai-dial-shared';

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
  const [searchValue, setSearchValue] = useState('');

  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
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

  const filteredComparableConversations = useMemo(
    () =>
      comparableConversations.filter((conv) =>
        doesEntityContainSearchItem(conv, searchValue),
      ),
    [comparableConversations, searchValue],
  );

  return (
    <div
      className="relative flex h-4/5 grow justify-center p-5 py-2"
      data-qa="conversation-to-compare"
    >
      <div className="flex h-full max-w-[465px] flex-col gap-4 divide-y divide-tertiary rounded bg-layer-2 py-6">
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
              type="checkbox"
              className="checkbox peer size-[18px]"
            />
            <IconCheck
              size={18}
              className="pointer-events-none invisible absolute text-accent-primary peer-checked:visible"
            />
            <label htmlFor="showAllCheckbox">
              {t('Show all conversations')}
            </label>
          </div>
        </div>
        <div className="overflow-auto px-6 pt-4">
          {comparableConversations.length ? (
            <>
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={t('Search conversations') ?? ''}
                className="input-form peer"
                data-qa="search-compare-conversation"
              />
              <ul className="mt-4">
                {filteredComparableConversations.length ? (
                  filteredComparableConversations.map((conv) => {
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
                        data-qa="conversation-row"
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
                  })
                ) : (
                  <p className="mt-4 text-secondary">
                    {t('No conversations found')}
                  </p>
                )}
              </ul>
            </>
          ) : (
            <p
              className="mt-4 text-secondary"
              data-qa="no-conversations-available"
            >
              {t('No conversations available')}
            </p>
          )}
        </div>
        {isLoading && (
          <Loader
            dataQa="compare-loader"
            containerClassName="absolute bg-blackout h-full max-w-[465px] top-0"
          />
        )}
      </div>
    </div>
  );
};
