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

  return (
    <div
      className={classNames(
        'flex w-full flex-col gap-[2px] md:max-w-[550px]',
        containerClassNames,
      )}
    >
      {(type === SharingType.Conversation ||
        type === SharingType.ConversationFolder) && (
        <CollapsibleSection
          name={t('Conversations')}
          openByDefault
          className={collapsibleSectionClassNames}
          dataQa="conversations-to-send-request"
        >
          {type === SharingType.Conversation ? (
            <ConversationRow
              itemComponentClassNames="cursor-pointer"
              item={entity as ConversationInfo}
              level={0}
            />
          ) : (
            <ConversationPublicationResources
              rootFolder={entity}
              resources={entities.map((entity) => ({
                action: publishAction,
                sourceUrl: entity.id,
                targetUrl: constructPath(
                  ApiKeys.Conversations,
                  'public',
                  path,
                  splitEntityId(entity.id).name,
                ),
                reviewUrl: entity.id,
              }))}
              forViewOnly
              isHaveTooltip={true}
            />
          )}
        </CollapsibleSection>
      )}
      {!!files.length && (
        <CollapsibleSection
          name={t('Files')}
          openByDefault
          dataQa="files-to-send-request"
          className={collapsibleSectionClassNames}
        >
          <FilePublicationResources
            uploadedFiles={files}
            resources={[]}
            forViewOnly
          />
        </CollapsibleSection>
      )}
      {(type === SharingType.Prompt || type === SharingType.PromptFolder) && (
        <CollapsibleSection
          name={t('Prompts')}
          openByDefault
          dataQa="prompts-to-send-request"
          className={collapsibleSectionClassNames}
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
                  ApiKeys.Conversations,
                  'public',
                  path,
                  splitEntityId(entity.id).name,
                ),
                reviewUrl: entity.id,
              }))}
              forViewOnly
              isHaveTooltip={true}
            />
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
