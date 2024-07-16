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

  const partialSelectedFolderIds = useAppSelector(
    PublicationSelectors.selectPartialChosenFolderIds,
  );
  const selectedFolderIds = useAppSelector((state) =>
    PublicationSelectors.selectChosenFolderIds(state, entities),
  );
  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  useEffect(() => {
    dispatch(
      PublicationActions.selectItemsToPublish({
        ids: [...entities.map((e) => e.id), ...files.map((f) => f.id)],
      }),
    );

    return () => {
      dispatch(PublicationActions.resetItemsToPublish());
    };
  }, [dispatch, entities, files]);

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
              itemComponentClassNames={classNames(
                'group/conversation-item cursor-pointer',
                publishAction === PublishActions.DELETE && 'text-error',
              )}
              item={entity as ConversationInfo}
              level={0}
              isChosen={chosenItemsIds.some((id) => id === entity.id)}
            />
          ) : (
            <ConversationPublicationResources
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
              onSelect={handleSelect}
              additionalItemData={{
                partialSelectedFolderIds,
                selectedFolderIds,
              }}
              showTooltip
              resourcesClassNames={classNames(
                publishAction === PublishActions.DELETE && 'text-error',
              )}
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
            onSelect={handleSelect}
            additionalItemData={{
              partialSelectedFolderIds,
              selectedFolderIds,
            }}
            resourcesClassNames={classNames(
              publishAction === PublishActions.DELETE && 'text-error',
            )}
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
              onSelect={handleSelect}
              itemComponentClassNames={classNames(
                'group/prompt-item cursor-pointer',
                publishAction === PublishActions.DELETE && 'text-error',
              )}
              item={entity}
              level={0}
              isChosen={chosenItemsIds.some((id) => id === entity.id)}
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
              onSelect={handleSelect}
              additionalItemData={{
                partialSelectedFolderIds,
                selectedFolderIds,
              }}
              resourcesClassNames={classNames(
                publishAction === PublishActions.DELETE && 'text-error',
              )}
            />
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
