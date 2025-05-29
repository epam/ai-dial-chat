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

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/selectors';

import { NA_VERSION } from '@/src/constants/public';

import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { EditableField } from '@/src/components/Common/EditableField';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { PublishActions } from '@epam/ai-dial-shared';

interface PublicationVersionInfoProps {
  item: PublicationReviewItem;
}

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const editState = useAppSelector((state) =>
    PublicationSelectors.selectEditStateByReviewUrl(state, item.id),
  );

  const handleChangeVersion = useCallback(
    (version: string) => {
      dispatch(
        PublicationActions.setEditStateByReviewUrl({
          reviewUrl: item.id,
          name: editState?.name ?? item.name,
          version,
        }),
      );
    },
    [dispatch, item.id, item.name, editState?.name],
  );

  const { publicVersionGroupId } = usePublicVersionGroupId(item);

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

  const isApplication = isApplicationId(item.id);
  const version = isApplication
    ? getVersionFromId(item.id)
    : (editState?.version ?? item.publicationInfo?.version ?? NA_VERSION);
  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

  return (
    <div className="flex shrink-0 items-center gap-2">
      {!isDeleteAction && publicVersionGroupId && !isApplication && (
        <PublicVersionSelector
          publicVersionGroupId={publicVersionGroupId}
          textBeforeSelector={t('Last: ')}
          btnClassNames="shrink-0"
          groupVersions
          readonly
        />
      )}
      <span
        className={classNames(
          'shrink-0 text-xs',
          isDeleteAction && 'text-error',
        )}
        data-qa="version"
      >
        <EditableField
          value={version}
          isEditMode={isEditMode}
          onChange={handleChangeVersion}
          inputClassName="w-[34px] text-xs"
        />
      </span>
    </div>
  );
};

interface PublicationRowProps {
  level: number;
  Icon: ReactNode;
  item: PublicationReviewItem;
  dataQa: string;
}

export const PublicationItemRow: React.FC<PublicationRowProps> = ({
  level,
  Icon,
  item,
  dataQa,
}) => {
  const dispatch = useAppDispatch();

  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const editState = useAppSelector((state) =>
    PublicationSelectors.selectEditStateByReviewUrl(state, item.id),
  );

  const [isFocused, setIsFocused] = useState(false);

  const handleChangeName = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(
        PublicationActions.setEditStateByReviewUrl({
          reviewUrl: item.id,
          name: e.target.value,
          version:
            editState?.version ?? item.publicationInfo?.version ?? NA_VERSION,
        }),
      );
    },
    [dispatch, item.id, editState?.version, item.publicationInfo?.version],
  );

  const editName = editState?.name ?? item.name;

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
          <div className="w-full truncate whitespace-pre break-all text-left text-primary">
            <input
              className="h-[24px] w-full border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
              value={editName}
              onChange={handleChangeName}
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
