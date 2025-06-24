import { IconDownload } from '@tabler/icons-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';

import { isVersionValid, prepareEntityName } from '@/src/utils/app/common';
import { isApplicationId, isFileId } from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { PublicationReviewItem } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/selectors';

import { NA_VERSION } from '@/src/constants/publication';

import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import { Checkbox } from '@/src/components/Common/Checkbox';
import { EditableField } from '@/src/components/Common/EditableField';

import { PublishActions } from '@epam/ai-dial-shared';

interface PublicationVersionInfoProps {
  item: PublicationReviewItem;
  isEditDisabled?: boolean;
}

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
  isEditDisabled,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const editState = useAppSelector((state) =>
    PublicationSelectors.selectEntityEditStateByReviewUrl(state, item.id),
  );

  const defaultVersion =
    editState?.version ?? item.publicationInfo?.version ?? NA_VERSION;
  const [inputVersion, setInputVersion] = useState(defaultVersion);

  useEffect(() => {
    setInputVersion(defaultVersion);
  }, [defaultVersion, isEditMode]);

  const handleChangeVersion = useCallback(
    (version: string) => {
      setInputVersion(version);
      dispatch(
        PublicationActions.setEntityEditStateByReviewUrl({
          reviewUrl: item.id,
          name: editState?.name ?? item.name,
          version,
        }),
      );
    },
    [dispatch, item.id, item.name, editState?.name],
  );

  const publicVersionGroupId = usePublicVersionGroupId(item);

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
          isEditMode={isDeleteAction || isEditDisabled ? false : isEditMode}
          onChange={handleChangeVersion}
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
  isEditDisabled?: boolean;
}

export const PublicationItemRow: React.FC<PublicationRowProps> = ({
  level,
  Icon,
  item,
  dataQa,
  isEditDisabled,
}) => {
  const dispatch = useAppDispatch();

  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const entityEditState = useAppSelector((state) =>
    PublicationSelectors.selectEntityEditStateByReviewUrl(state, item.id),
  );
  const selectedPublicationResources = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  const isSelected = useMemo(
    () => selectedPublicationResources.includes(item.id),
    [item.id, selectedPublicationResources],
  );

  const [inputName, setInputName] = useState(item.name);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setInputName(item.name);
  }, [item.name, isEditMode]);

  const handleChangeName = useCallback(
    (name: string) => {
      setInputName(name);
      dispatch(
        PublicationActions.setEntityEditStateByReviewUrl({
          reviewUrl: item.id,
          name,
          version:
            entityEditState?.version ??
            item.publicationInfo?.version ??
            NA_VERSION,
        }),
      );
    },
    [
      dispatch,
      item.id,
      entityEditState?.version,
      item.publicationInfo?.version,
    ],
  );

  const handleSelect = useCallback(() => {
    dispatch(
      PublicationActions.selectItemsToPublish({
        ids: [item.id],
      }),
    );
  }, [dispatch, item.id]);

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
        <Checkbox
          checked={isSelected}
          onChange={handleSelect}
          className="mr-0"
        />
        <span className="flex">{Icon}</span>
        <EditableField
          value={inputName}
          isEditMode={isEditDisabled || isDeleteAction ? false : isEditMode}
          onChange={handleChangeName}
          inputClassName={classNames(
            'w-full',
            !prepareEntityName(inputName).trim() && '!border-b-error',
          )}
          className={classNames(
            item.publicationInfo?.isNotExist && 'text-secondary',
            item.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
        />
      </span>
      <PublicationVersionInfo item={item} isEditDisabled={isEditDisabled} />
    </div>
  );
};
