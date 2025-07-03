import { IconDownload } from '@tabler/icons-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';

import {
  isVersionExists,
  replaceSpacesFromString,
} from '@/src/utils/app/common';
import {
  getStringValidationErrors,
  getVersionValidationErrors,
} from '@/src/utils/app/forms';
import { isApplicationId, isFileId } from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { BackendResourceTypeName } from '@/src/types/common';
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
  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );

  const defaultVersion =
    editState?.version ?? item.publicationInfo?.version ?? NA_VERSION;
  const [inputVersion, setInputVersion] = useState(defaultVersion);
  const [errors, setErrors] = useState<string[]>([]);

  const isApplication = useMemo(() => isApplicationId(item.id), [item.id]);

  useEffect(() => {
    setInputVersion(defaultVersion);
  }, [defaultVersion, isEditMode]);

  useEffect(() => {
    if (isEditMode) {
      const isExistVersion = isVersionExists(
        defaultVersion,
        item.id,
        publicVersionGroups,
        item.name,
      );
      setErrors(
        getVersionValidationErrors(
          defaultVersion,
          isExistVersion,
          isApplication,
        ),
      );
    }
  }, [
    defaultVersion,
    isApplication,
    isEditMode,
    item.id,
    item.name,
    publicVersionGroups,
  ]);

  const handleChangeVersion = useCallback(
    (version: string) => {
      setInputVersion(version);

      const isExistVersion = isVersionExists(
        version,
        item.id,
        publicVersionGroups,
        item.name,
      );
      setErrors(
        getVersionValidationErrors(version, isExistVersion, isApplication),
      );

      dispatch(
        PublicationActions.setEntityEditStateByReviewUrl({
          reviewUrl: item.id,
          name: editState?.name ?? item.name,
          version,
        }),
      );
    },
    [
      item.id,
      item.name,
      publicVersionGroups,
      isApplication,
      dispatch,
      editState?.name,
    ],
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
            'w-[70px] text-right text-xs',
            (errors.length || inputVersion === NA_VERSION) && '!border-b-error',
            errors.length && 'pl-5',
          )}
          placeholder="0.0.1"
          errors={errors}
          tooltipIconClassName="ml-1"
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
  itemTypeName: BackendResourceTypeName;
  isEditDisabled?: boolean;
}

export const PublicationItemRow: React.FC<PublicationRowProps> = ({
  level,
  Icon,
  item,
  dataQa,
  isEditDisabled,
  itemTypeName,
}) => {
  const dispatch = useAppDispatch();

  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const selectedPublication = useAppSelector(
    PublicationSelectors.selectSelectedPublication,
  );
  const entityEditState = useAppSelector((state) =>
    PublicationSelectors.selectEntityEditStateByReviewUrl(state, item.id),
  );
  const selectedPublicationResources = useAppSelector(
    PublicationSelectors.selectSelectedItemsToApprove,
  );

  const isSelected = useMemo(
    () => selectedPublicationResources.includes(item.id),
    [item.id, selectedPublicationResources],
  );

  const [inputName, setInputName] = useState(item.name);
  const [isFocused, setIsFocused] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const cleanName = replaceSpacesFromString(item.name);
    setInputName(cleanName);
    const nameErrors = getStringValidationErrors({
      value: cleanName,
      label: `${itemTypeName} name`,
      checkDotsInTheEnd: true,
    });
    setErrors(nameErrors);
  }, [item.name, isEditMode, itemTypeName]);

  const handleChangeName = useCallback(
    (name: string) => {
      setInputName(name);

      setErrors(
        getStringValidationErrors({
          value: name,
          label: `${itemTypeName} name`,
          checkDotsInTheEnd: true,
        }),
      );

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
      itemTypeName,
      dispatch,
      item.id,
      item.publicationInfo?.version,
      entityEditState?.version,
    ],
  );

  const handleSelect = useCallback(() => {
    dispatch(
      PublicationActions.selectItemsToApprove({
        publicationUrl: selectedPublication?.url ?? '',
        ids: [item.id],
      }),
    );
  }, [dispatch, item.id, selectedPublication?.url]);

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
          inputClassName={classNames('w-full', errors.length && 'pr-5')}
          className={classNames(
            item.publicationInfo?.isNotExist && 'text-secondary',
            item.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
          tooltipIconClassName="right-5"
          errors={errors}
        />
      </span>
      <PublicationVersionInfo item={item} isEditDisabled={isEditDisabled} />
    </div>
  );
};
