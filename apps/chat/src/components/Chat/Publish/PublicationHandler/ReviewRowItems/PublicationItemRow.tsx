import { IconDownload } from '@tabler/icons-react';
import { ReactNode, useCallback, useEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { useDebouncedInput } from '@/src/hooks/useDebounceInput';
import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';

import { isVersionValid } from '@/src/utils/app/common';
import { isApplicationId, isFileId } from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { PublicationReviewItem } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/selectors';

import { NA_VERSION } from '@/src/constants/public';

import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { EditableField } from '@/src/components/Common/EditableField';

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

  const initialVersion = item.publicationInfo?.version ?? NA_VERSION;

  const [inputVersion, handleDebouncedChangeVersion] = useDebouncedInput(
    initialVersion,
    handleChangeVersion,
  );

  useEffect(() => {
    handleDebouncedChangeVersion(initialVersion);
  }, [handleDebouncedChangeVersion, isEditMode, initialVersion]);

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
          value={inputVersion}
          isEditMode={isDeleteAction ? false : isEditMode}
          onChange={handleDebouncedChangeVersion}
          inputClassName={classNames(
            'w-[34px] text-xs',
            (!isVersionValid(inputVersion) || inputVersion === NA_VERSION) &&
              '!border-b-error',
          )}
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
    (name: string) => {
      dispatch(
        PublicationActions.setEditStateByReviewUrl({
          reviewUrl: item.id,
          name,
          version:
            editState?.version ?? item.publicationInfo?.version ?? NA_VERSION,
        }),
      );
    },
    [dispatch, item.id, editState?.version, item.publicationInfo?.version],
  );

  const [inputName, handleDebouncedChangeName] = useDebouncedInput(
    item.name,
    handleChangeName,
  );

  useEffect(() => {
    handleDebouncedChangeName(item.name);
  }, [handleDebouncedChangeName, isEditMode, item.name]);

  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

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
        <EditableField
          value={inputName}
          isEditMode={isDeleteAction ? false : isEditMode}
          onChange={handleDebouncedChangeName}
          inputClassName={classNames('w-full', !inputName && '!border-b-error')}
          className={classNames(
            item.publicationInfo?.isNotExist && 'text-secondary',
            item.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
        />
      </span>
      <PublicationVersionInfo item={item} />
    </div>
  );
};
