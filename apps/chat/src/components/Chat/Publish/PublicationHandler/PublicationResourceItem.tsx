import { IconDownload } from '@tabler/icons-react';
import { useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';

import {
  isApplicationId,
  isConversationId,
  isFileId,
  isPromptId,
} from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';
import { ApiUtils, getVersionFromId } from '@/src/utils/server/api';

import { DialFile } from '@/src/types/files';
import { PublicationReviewItem } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { NA_VERSION } from '@/src/constants/public';

import { PublicVersionSelector } from '../PublicVersionSelector';
import { PublicationApplicationRow } from './ReviewRowItems/PublicationApplicationRow';
import { PublicationConversationRow } from './ReviewRowItems/PublicationConversationRow';
import { PublicationFileRow } from './ReviewRowItems/PublicationFileRow';
import { PublicationPromptRow } from './ReviewRowItems/PublicationPromptRow';

import {
  ConversationInfo,
  Prompt,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

interface PublicationVersionInfoProps {
  item: PublicationReviewItem;
  publicVersionGroupId: string | undefined;
}

const isEditMode = false;

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
  publicVersionGroupId,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

  if (isApplicationId(item.id)) {
    const appVersion = getVersionFromId(item.id);

    return (
      <span
        className={classNames(
          'shrink-0 text-xs',
          isDeleteAction && 'text-error',
        )}
        data-qa="version"
      >
        {isEditMode ? (
          <input
            className="h-[24px] w-[35px] border-b border-primary bg-layer-2 px-1 py-[2px] text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
            value={appVersion}
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
            onChange={() => {}}
          />
        ) : (
          appVersion
        )}
      </span>
    );
  }

  if (isFileId(item.id)) {
    return (
      <a
        download={item.name}
        href={constructPath('/api', ApiUtils.encodeApiUrl(item.id))}
        data-qa="download"
      >
        <IconDownload
          className="shrink-0 text-secondary hover:text-accent-primary"
          size={18}
        />
      </a>
    );
  }

  const version = item.publicationInfo?.version || NA_VERSION;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {!isDeleteAction && publicVersionGroupId && (
        <PublicVersionSelector
          publicVersionGroupId={publicVersionGroupId}
          textBeforeSelector={t('Last: ')}
          btnClassNames="shrink-0"
          groupVersions
          readonly
        />
      )}
      <span
        className={classNames('pr-2 text-xs', isDeleteAction && 'text-error')}
        data-qa="version"
      >
        {isEditMode ? (
          <input
            className="h-[24px] w-[35px] border-b border-primary bg-layer-2 px-1 py-[2px] text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
            value={version}
            onChange={() => {
              // eslint-disable-next-line no-console
              console.log('edit');
            }}
          />
        ) : (
          version
        )}
      </span>
    </div>
  );
};

interface PublicationRowRendererProps {
  item: PublicationReviewItem;
  level: number;
}

const PublicationRowRenderer: React.FC<PublicationRowRendererProps> = ({
  item,
  level,
}) => {
  if (isApplicationId(item.id)) {
    return (
      <PublicationApplicationRow
        level={level}
        application={item as ShareEntity}
      />
    );
  }

  if (isConversationId(item.id)) {
    return (
      <PublicationConversationRow
        level={level}
        conversation={item as ConversationInfo}
      />
    );
  }

  if (isPromptId(item.id)) {
    return <PublicationPromptRow level={level} prompt={item as Prompt} />;
  }

  return <PublicationFileRow level={level} file={item as DialFile} />;
};

interface PublicationResourceItemProps {
  item: PublicationReviewItem;
  level: number;
}

export const PublicationResourceItem = ({
  item,
  level,
}: PublicationResourceItemProps & Record<string, unknown>) => {
  const [isFocused, setIsFocused] = useState(false);

  const { publicVersionGroupId } = usePublicVersionGroupId(item);

  return (
    <div
      className={classNames(
        'flex items-center justify-between gap-2 rounded hover:bg-accent-primary-alpha',
        isFocused && 'bg-accent-primary-alpha',
      )}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <PublicationRowRenderer item={item} level={level} />
      <PublicationVersionInfo
        item={item}
        publicVersionGroupId={publicVersionGroupId}
      />
    </div>
  );
};
