import { IconDownload } from '@tabler/icons-react';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';

import {
  isVersionExists,
  replaceSpacesFromString,
} from '@/src/utils/app/common';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import {
  getStringValidationErrors,
  getVersionValidationErrors,
} from '@/src/utils/app/forms';
import { isApplicationId, isFileId, isToolsetId } from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { BackendResourceTypeName } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import { PublicationSelectors } from '@/src/store/selectors';

import { DEFAULT_VERSION, NA_VERSION } from '@/src/constants/publication';

import { PublicVersionSelector } from '@/src/components/Chat/Publish/PublicVersionSelector';
import {
  PublicationRequestFormData,
  PublishRequestFieldsNames,
} from '@/src/components/Chat/Publish/form';
import { Checkbox } from '@/src/components/Common/Checkbox';
import { EditableField } from '@/src/components/Common/EditableField';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';

interface PublicationVersionInfoProps {
  item: ShareEntity;
}

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );
  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const editState = useAppSelector((state) =>
    PublicationSelectors.selectEntityEditStateByReviewUrl(state, item.id),
  );
  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );

  const { watch } = useFormContext<PublicationRequestFormData>();
  const publishToUrl = watch(PublishRequestFieldsNames.PUBLISH_TO_URL);

  const defaultVersion =
    editState?.version ?? item.publicationInfo?.version ?? NA_VERSION;
  const [inputVersion, setInputVersion] = useState(defaultVersion);
  const [errors, setErrors] = useState<string[]>([]);

  const isApplication = useMemo(() => isApplicationId(item.id), [item.id]);

  useEffect(() => {
    setInputVersion(defaultVersion);
  }, [defaultVersion, isEditMode]);

  const publicItemId = useMemo(() => {
    let itemId = item.id;
    if (publicationModel) {
      const parts = item.id.split('/');
      if (parts.length > 1) {
        parts[1] = publishToUrl;
        itemId = parts.join('/');
      }
    }
    return itemId;
  }, [item.id, publicationModel, publishToUrl]);

  useEffect(() => {
    if (
      publicationModel ||
      (isEditMode && item.publicationInfo?.action !== PublishActions.DELETE)
    ) {
      const isExistVersion = isVersionExists(
        inputVersion,
        publicItemId,
        publicVersionGroups,
        item.name,
      );

      const validationErrors = getVersionValidationErrors(
        inputVersion,
        isExistVersion,
        isApplication,
      );
      setErrors(validationErrors);
    }
  }, [
    inputVersion,
    isApplication,
    isEditMode,
    item.id,
    item.name,
    item.publicationInfo?.action,
    publicItemId,
    publicVersionGroups,
    publicationModel,
    publishToUrl,
  ]);

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
    [dispatch, editState?.name, item.id, item.name],
  );

  const usePublicVersionGroupIdParams = useMemo(
    () => ({
      ...item,
      id: publicItemId,
    }),
    [item, publicItemId],
  );

  const publicVersionGroupId = usePublicVersionGroupId(
    usePublicVersionGroupIdParams,
  );

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
          'relative shrink-0 text-xs',
          isDeleteAction && 'text-error',
        )}
        data-qa="version"
      >
        <EditableField
          value={inputVersion}
          isEditMode={
            publicationModel &&
            !isToolsetId(publicationModel.entity.id) &&
            !isApplicationId(publicationModel.entity.id) &&
            publicationModel.action !== PublishActions.DELETE
              ? true
              : isDeleteAction || isToolsetId(item.id)
                ? false
                : isEditMode
          }
          onChange={handleChangeVersion}
          inputClassName={classNames(
            'w-[70px] text-right text-xs',
            (errors.length || inputVersion === NA_VERSION) && '!border-b-error',
            errors.length && 'pl-5',
          )}
          placeholder={DEFAULT_VERSION}
          errors={errors}
          tooltipIconClassName="ml-1"
          dataQA="version"
        />
      </span>
    </div>
  );
};

interface PublicationRowProps {
  level: number;
  Icon: ReactNode;
  item: ShareEntity;
  dataQa: string;
  itemTypeName: BackendResourceTypeName;
  publicationUrl: string;
}

export const PublicationItemRow: React.FC<PublicationRowProps> = ({
  level,
  Icon,
  item,
  dataQa,
  itemTypeName,
  publicationUrl,
}) => {
  const dispatch = useAppDispatch();

  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );
  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const entityEditState = useAppSelector((state) =>
    PublicationSelectors.selectEntityEditStateByReviewUrl(state, item.id),
  );
  const selectedPublicationItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedPublicationItems(state, publicationUrl),
  );
  const selectedCredentialsItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedCredentialsItems(state, publicationUrl),
  );
  const editState = useAppSelector(
    PublicationSelectors.selectEntitiesEditState,
  );

  const isSelected = useMemo(
    () => selectedPublicationItems.includes(item.id),
    [item.id, selectedPublicationItems],
  );

  const [inputName, setInputName] = useState(item.name);
  const [isFocused, setIsFocused] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const cleanName = replaceSpacesFromString(item.name);
    setInputName(cleanName);
  }, [item.name, isEditMode]);

  useEffect(() => {
    const isNotUniqName = Object.entries(editState).some(
      ([key, { name: editStateName }]) => {
        const keyFolderId = getFolderIdFromEntityId(key);
        return (
          item.id !== key &&
          item.folderId === keyFolderId &&
          inputName.trim() === editStateName.trim()
        );
      },
    );
    const nameErrors = getStringValidationErrors({
      value: inputName,
      label: `${itemTypeName} name`,
      checkDotsInTheEnd: true,
      isNotUniqName,
    });
    setErrors(nameErrors);
  }, [editState, inputName, item.folderId, item.id, itemTypeName]);

  const handleChangeName = useCallback(
    (name: string) => {
      setInputName(name);

      dispatch(
        PublicationActions.setEntityEditStateByReviewUrl({
          reviewUrl: item.id,
          name,
          version: entityEditState?.version ?? NA_VERSION,
        }),
      );
    },
    [dispatch, entityEditState?.version, item.id],
  );

  const handleSelect = useCallback(() => {
    dispatch(
      PublicationActions.selectPublicationItems({
        publicationUrl,
        ids: [item.id],
      }),
    );

    if (isToolsetId(item.id) && item.publicationInfo?.publishCredentials) {
      if (
        (!selectedCredentialsItems.includes(item.id) &&
          !selectedPublicationItems.includes(item.id)) ||
        (selectedCredentialsItems.includes(item.id) &&
          selectedPublicationItems.includes(item.id))
      ) {
        dispatch(
          PublicationActions.selectCredentialsItems({
            publicationUrl,
            ids: [item.id],
          }),
        );
      }
    }
  }, [
    dispatch,
    item.id,
    item.publicationInfo?.publishCredentials,
    selectedCredentialsItems,
    publicationUrl,
    selectedPublicationItems,
  ]);

  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

  return (
    <div
      className={classNames(
        'flex items-center justify-between rounded pr-2 hover:bg-accent-primary-alpha',
        isFocused && 'bg-accent-primary-alpha',
      )}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      data-qa={'entity-publication-row'}
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
          isEditMode={
            isDeleteAction || isToolsetId(item.id) || publicationModel
              ? false
              : isEditMode
          }
          onChange={handleChangeName}
          inputClassName={classNames('w-full', errors.length && 'pr-5')}
          className={classNames(
            item.publicationInfo?.isNotExist && 'text-secondary',
            item.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
          tooltipIconClassName="right-5"
          errors={errors}
          dataQA='entity-input'
        />
      </span>
      <PublicationVersionInfo item={item} />
    </div>
  );
};
