import { IconDownload } from '@tabler/icons-react';
import { ReactNode, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';

import { isApplicationId, isFileId } from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';
import { ApiUtils, getVersionFromId } from '@/src/utils/server/api';

import { PublicationReviewItem } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { NA_VERSION } from '@/src/constants/public';

import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { PublishActions } from '@epam/ai-dial-shared';

interface PublicationVersionInfoProps {
  item: PublicationReviewItem;
}

const isEditMode = false;

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const { publicVersionGroupId } = usePublicVersionGroupId(item);

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
            className="h-[24px] w-[35px] border-b border-primary bg-layer-2 py-[2px] text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
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
        className={classNames('text-xs', isDeleteAction && 'text-error')}
        data-qa="version"
      >
        {isEditMode ? (
          <input
            className="h-[24px] w-[35px] border-b border-primary bg-layer-2 py-[2px] text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
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

interface PublicationRowProps {
  level: number;
  Icon: ReactNode;
  item: PublicationReviewItem;
  dataQa: string;
  onEdit: (name: string) => void;
}

export const PublicationItemRow: React.FC<PublicationRowProps> = ({
  level,
  Icon,
  item,
  dataQa,
  onEdit,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onEdit(e.target.value);
    },
    [onEdit],
  );

  return (
    <div
      className={classNames(
        'flex items-center justify-between rounded pr-2 hover:bg-accent-primary-alpha',
        isFocused && 'bg-accent-primary-alpha',
      )}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <span
        className="relative flex min-h-[34px] w-full flex-1 cursor-pointer items-center gap-2 truncate rounded px-4"
        style={{
          paddingLeft: `${level * 24 + 16}px`,
        }}
        data-qa={dataQa}
      >
        <span className="flex">{Icon}</span>
        {isEditMode ? (
          <div className="block truncate whitespace-pre break-all text-left text-primary">
            <input
              className="h-[24px] w-full border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
              value={item.name}
              onChange={handleChange}
            />
          </div>
        ) : (
          <Tooltip
            tooltip={item.name}
            contentClassName="max-w-[400px] break-all"
            triggerClassName={classNames(
              'truncate whitespace-pre',
              item.publicationInfo?.isNotExist && 'text-secondary',
              item.publicationInfo?.action === PublishActions.DELETE &&
                'text-error',
            )}
            dataQa="entity-name"
          >
            {item.name}
          </Tooltip>
        )}
      </span>
      <PublicationVersionInfo item={item} />
    </div>
  );
};
