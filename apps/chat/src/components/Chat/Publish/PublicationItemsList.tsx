import { useCallback, useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';

import { ConversationInfo } from '@/src/types/chat';
import { ApiKeys, Entity } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import {
  ConversationRow,
  PromptsRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';

import {
  ConversationPublicationResources,
  FilePublicationResources,
  PromptPublicationResources,
} from './PublicationResources';

interface Props {
  type: SharingType;
  entity: Entity;
  entities: Entity[];
  path: string;
  files: DialFile[];
  containerClassNames?: string;
  collapsibleSectionClassNames?: string;
  publishAction: PublishActions;
  showTooltip?: boolean;
}

export function PublicationItemsList({
  type,
  entities,
  entity,
  path,
  files,
  containerClassNames,
  collapsibleSectionClassNames,
  publishAction,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  useEffect(() => {
    return () => {
      dispatch(PublicationActions.resetItemsToPublish());
    };
  }, [dispatch]);

  const handleSelect = useCallback(
    (ids: string[]) => {
      dispatch(
        PublicationActions.selectItemsToPublish({
          ids,
        }),
      );
    },
    [dispatch],
  );

  return (
    <div
      className={classNames(
        'flex w-full flex-col gap-[2px] overflow-y-visible md:max-w-[550px]',
        containerClassNames,
      )}
    >
      {(type === SharingType.Conversation ||
        type === SharingType.ConversationFolder) && (
        <CollapsibleSection
          togglerClassName="!text-sm !text-primary"
          name={t('Conversations')}
          openByDefault
          className={classNames('!pl-0', collapsibleSectionClassNames)}
          dataQa="conversations-to-send-request"
        >
          {type === SharingType.Conversation ? (
            <ConversationRow
              onSelect={handleSelect}
              itemComponentClassNames="cursor-pointer group/conversation-item"
              item={entity as ConversationInfo}
              level={0}
            />
          ) : (
            <ConversationPublicationResources
              onSelect={handleSelect}
              rootFolder={entity}
              resources={entities.map((entity) => ({
                action: publishAction,
                sourceUrl: entity.id,
                targetUrl: constructPath(
                  ApiKeys.Conversations,
                  PUBLIC_URL_PREFIX,
                  path,
                  splitEntityId(entity.id).name,
                ),
                reviewUrl: entity.id,
              }))}
              readonly
              additionalItemData={{
                partialSelectedFolderIds: [
                  !entities
                    .map((e) => e.id)
                    .filter((id) => id.startsWith(`${entity.id}/`))
                    .every((id) => chosenItemsIds.includes(id))
                    ? `${entity.id}/`
                    : '',
                ],
              }}
              showTooltip
            />
          )}
        </CollapsibleSection>
      )}
      {!!files.length && (
        <CollapsibleSection
          togglerClassName="!text-sm !text-primary"
          name={t('Files')}
          openByDefault
          dataQa="files-to-send-request"
          className={classNames('!pl-0', collapsibleSectionClassNames)}
        >
          <FilePublicationResources
            uploadedFiles={files}
            resources={[]}
            readonly
            showTooltip
          />
        </CollapsibleSection>
      )}
      {(type === SharingType.Prompt || type === SharingType.PromptFolder) && (
        <CollapsibleSection
          togglerClassName="!text-sm !text-primary"
          name={t('Prompts')}
          openByDefault
          dataQa="prompts-to-send-request"
          className={classNames('!pl-0', collapsibleSectionClassNames)}
        >
          {type === SharingType.Prompt ? (
            <PromptsRow
              itemComponentClassNames="cursor-pointer"
              item={entity}
              level={0}
            />
          ) : (
            <PromptPublicationResources
              rootFolder={entity}
              resources={entities.map((entity) => ({
                action: publishAction,
                sourceUrl: entity.id,
                targetUrl: constructPath(
                  ApiKeys.Prompts,
                  PUBLIC_URL_PREFIX,
                  path,
                  splitEntityId(entity.id).name,
                ),
                reviewUrl: entity.id,
              }))}
              readonly
              showTooltip
            />
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
