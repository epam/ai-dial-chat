import { IconDownload } from '@tabler/icons-react';
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useWatch } from 'react-hook-form';

import classNames from 'classnames';

import { useRouter } from 'next/router';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { useTranslation } from '@/src/hooks/useTranslation';

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
import {
  conversationDisplayNameToStorage,
  translateConversationDisplayName,
} from '@/src/utils/app/translateConversationDisplayName';
import {
  ApiUtils,
  getIdWithoutVersionFromApiKey,
  getVersionFromId,
} from '@/src/utils/server/api';

import { BackendResourceTypeName } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';
import {
  ModelsSelectors,
  PublicationSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
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
  publicationUrl: string;
}

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
  publicationUrl,
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
  const selectedPublicationItems = useAppSelector((state) =>
    PublicationSelectors.selectSelectedPublicationItems(state, publicationUrl),
  );

  const publishToUrl = useWatch<
    PublicationRequestFormData,
    typeof PublishRequestFieldsNames.PUBLISH_TO_URL
  >({
    name: PublishRequestFieldsNames.PUBLISH_TO_URL,
  });

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

  const entity = useMemo(
    () => ({
      ...item,
      id: publicItemId,
    }),
    [item, publicItemId],
  );

  const publicVersionGroupId = usePublicVersionGroupId(entity) ?? '';
  const versionGroup = useAppSelector((state) =>
    PublicationSelectors.selectPublicVersionGroupById(
      state,
      publicVersionGroupId,
    ),
  );
  const modelsVersionGroup = useAppSelector((state) =>
    ModelsSelectors.selectModelsVersionGroupByGroupId(
      state,
      publicVersionGroupId,
    ),
  );
  const toolsetVersionGroup = useAppSelector((state) =>
    ToolsetSelectors.selectToolsetVersionGroupByGroupId(
      state,
      publicVersionGroupId,
    ),
  );

  const defaultVersion =
    editState?.version ?? item.publicationInfo?.version ?? NA_VERSION;

  const [inputVersion, setInputVersion] = useState(defaultVersion);
  const [errors, setErrors] = useState<string[]>([]);

  const isApplicationOrToolset = useMemo(
    () => isApplicationId(item.id) || isToolsetId(item.id),
    [item.id],
  );

  useEffect(() => {
    setInputVersion(defaultVersion);
  }, [defaultVersion, isEditMode]);

  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

  useEffect(() => {
    if (publicationModel || (isEditMode && !isDeleteAction)) {
      const isExistVersion = isVersionExists(
        inputVersion,
        publicItemId,
        publicVersionGroups,
        item.name,
      );

      const validationErrors = getVersionValidationErrors(
        inputVersion,
        isExistVersion,
        isApplicationOrToolset,
      );
      setErrors(validationErrors);
    }
  }, [
    inputVersion,
    isApplicationOrToolset,
    isDeleteAction,
    isEditMode,
    item.id,
    item.name,
    publicItemId,
    publicVersionGroups,
    publicationModel,
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

  const handleSelectCheckboxVersion = useCallback(
    (versionId: string) => {
      dispatch(
        PublicationActions.selectPublicationItems({
          publicationUrl,
          ids: [versionId],
        }),
      );
    },
    [dispatch, publicationUrl],
  );

  const itemVersionsSelected = useMemo(
    () =>
      selectedPublicationItems.filter((id) =>
        id.startsWith(getIdWithoutVersionFromApiKey(item.id)),
      ),
    [item.id, selectedPublicationItems],
  );

  const overrideTriggerText = useMemo(() => {
    if (isDeleteAction) {
      if (itemVersionsSelected.length > 1) {
        const isAllVersionsSelected =
          versionGroup?.allVersions.length === itemVersionsSelected.length ||
          modelsVersionGroup.length === itemVersionsSelected.length ||
          toolsetVersionGroup.length === itemVersionsSelected.length;

        return t(isAllVersionsSelected ? ChatI18nKeys.All : ChatI18nKeys.Few);
      } else if (itemVersionsSelected.length === 1) {
        return getVersionFromId(itemVersionsSelected[0]);
      }
    }

    return undefined;
  }, [
    isDeleteAction,
    itemVersionsSelected,
    modelsVersionGroup.length,
    t,
    toolsetVersionGroup.length,
    versionGroup?.allVersions.length,
  ]);

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

  return (
    <div className="flex shrink-0 items-center gap-2">
      {publicVersionGroupId && (
        <PublicVersionSelector
          overrideTriggerText={overrideTriggerText}
          publicVersionGroupId={publicVersionGroupId}
          triggerTextClassName={classNames(
            isDeleteAction && 'text-xs text-error',
          )}
          textBeforeSelector={!isDeleteAction ? t(ChatI18nKeys.LastColon) : ''}
          btnClassNames={classNames(
            'shrink-0',
            isDeleteAction && 'text-error hover:text-error',
          )}
          selectedCheckboxVersionIds={itemVersionsSelected}
          onSelectCheckboxVersion={
            isDeleteAction ? handleSelectCheckboxVersion : undefined
          }
          groupVersions={!isDeleteAction}
          readonly={!isDeleteAction}
        />
      )}
      {!isDeleteAction && (
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
              !isApplicationId(publicationModel.entity.id)
                ? true
                : isDeleteAction || isToolsetId(item.id)
                  ? false
                  : isEditMode
            }
            onChange={handleChangeVersion}
            inputClassName={classNames(
              'w-[70px] text-end text-xs',
              (errors.length || inputVersion === NA_VERSION) &&
                '!border-b-error',
              errors.length && 'ps-5',
            )}
            placeholder={DEFAULT_VERSION}
            errors={errors}
            tooltipIconClassName="ms-1"
            dataQA="version"
          />
        </span>
      )}
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
  const router = useRouter();
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const isConversation =
    itemTypeName === BackendResourceTypeName.CONVERSATION;

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
    () =>
      selectedPublicationItems.some((id) =>
        id.startsWith(getIdWithoutVersionFromApiKey(item.id)),
      ),
    [item.id, selectedPublicationItems],
  );

  const [inputName, setInputName] = useState(item.name);
  const [isFocused, setIsFocused] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const storedName = entityEditState?.name ?? item.name;

  const toDisplayName = useCallback(
    (name: string) => {
      const cleanName = replaceSpacesFromString(name);
      if (!isConversation) {
        return cleanName;
      }

      return replaceSpacesFromString(
        translateConversationDisplayName(cleanName, router.locale, t),
      );
    },
    [isConversation, router.locale, t],
  );

  const toStorageName = useCallback(
    (displayName: string) => {
      if (!isConversation) {
        return displayName;
      }

      return conversationDisplayNameToStorage(
        displayName,
        item.name,
        router.locale,
        t,
      );
    },
    [isConversation, item.name, router.locale, t],
  );

  useEffect(() => {
    const displayName = toDisplayName(storedName);
    setInputName(displayName);
  }, [storedName, isEditMode, toDisplayName]);

  useEffect(() => {
    const inputStoredName = toStorageName(inputName);
    const isNotUniqName = Object.entries(editState).some(
      ([key, { name: editStateName }]) => {
        const keyFolderId = getFolderIdFromEntityId(key);
        return (
          item.id !== key &&
          item.folderId === keyFolderId &&
          inputStoredName.trim() === editStateName.trim()
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
  }, [editState, inputName, item.folderId, item.id, itemTypeName, toStorageName]);

  const handleChangeName = useCallback(
    (name: string) => {
      setInputName(name);

      dispatch(
        PublicationActions.setEntityEditStateByReviewUrl({
          reviewUrl: item.id,
          name: toStorageName(name),
          version: entityEditState?.version ?? NA_VERSION,
        }),
      );
    },
    [dispatch, entityEditState?.version, item.id, toStorageName],
  );

  const handleSelect = useCallback(() => {
    const sameGroupSelectedPublicationItems = selectedPublicationItems.filter(
      (selectedId) =>
        selectedId.startsWith(getIdWithoutVersionFromApiKey(item.id)) &&
        item.id.split('/').length === selectedId.split('/').length &&
        selectedId !== item.id,
    );

    if (sameGroupSelectedPublicationItems.length) {
      dispatch(
        PublicationActions.unselectPublicationItems({
          publicationUrl,
          ids: sameGroupSelectedPublicationItems,
        }),
      );
    }

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
    publicationUrl,
    item.id,
    item.publicationInfo?.publishCredentials,
    selectedCredentialsItems,
    selectedPublicationItems,
  ]);

  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

  return (
    <div
      className={classNames(
        'flex items-center justify-between rounded pe-2 hover:bg-accent-primary-alpha',
        isFocused && 'bg-accent-primary-alpha',
      )}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      data-qa={'entity-publication-row'}
    >
      <span
        className="relative flex min-h-[34px] w-full flex-1 cursor-pointer items-center gap-2 truncate rounded px-4"
        style={{
          paddingInlineStart: `${level * 24 + 16}px`,
        }}
        data-qa={dataQa}
      >
        <Checkbox
          checked={isSelected}
          onChange={handleSelect}
          className="me-0"
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
          inputClassName={classNames('w-full', errors.length && 'pe-5')}
          className={classNames(
            item.publicationInfo?.isNotExist && 'text-secondary',
            item.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
          tooltipIconClassName="end-5"
          errors={errors}
          dataQA="entity-input"
        />
      </span>
      <PublicationVersionInfo publicationUrl={publicationUrl} item={item} />
    </div>
  );
};
