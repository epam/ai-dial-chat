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
          name={t('chat.publish.sections.conversations.label')}
          openByDefault
          className={classNames('!pl-0', collapsibleSectionClassNames)}
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
                  PUBLIC_URL_PREFIX,
                  path,
                  splitEntityId(entity.id).name,
                ),
                reviewUrl: entity.id,
              }))}
              forViewOnly
              showTooltip
            />
          )}
        </CollapsibleSection>
      )}
      {!!files.length && (
        <CollapsibleSection
          togglerClassName="!text-sm !text-primary"
          name={t('chat.publish.sections.files.label')}
          openByDefault
          dataQa="files-to-send-request"
          className={classNames('!pl-0', collapsibleSectionClassNames)}
        >
          <FilePublicationResources
            uploadedFiles={files}
            resources={[]}
            forViewOnly
            showTooltip
          />
        </CollapsibleSection>
      )}
      {(type === SharingType.Prompt || type === SharingType.PromptFolder) && (
        <CollapsibleSection
          togglerClassName="!text-sm !text-primary"
          name={t('chat.publish.sections.prompts.label')}
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
              forViewOnly
              showTooltip
            />
          )}
        </CollapsibleSection>
      )}
    </div>
  );
}
