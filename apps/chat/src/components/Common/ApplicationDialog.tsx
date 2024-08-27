import { IconTrashX, IconWorldShare, IconX } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath, notAllowedSymbols } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import {
  CustomApplicationModel,
  PublicCustomApplicationModel,
} from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityFeatures } from '@/src/types/models';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import Modal from '@/src/components/Common/Modal';

import { PublishModal } from '../Chat/Publish/PublishWizard';
import { CustomLogoSelect } from '../Settings/CustomLogoSelect';
import { ConfirmDialog } from './ConfirmDialog';
import { MultipleComboBox } from './MultipleComboBox';
import { Spinner } from './Spinner';
import Tooltip from './Tooltip';

const ApplicationDialogView: React.FC<Props> = (props) => {
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    trigger,
    control,
    formState: { errors, isValid },
  } = useForm<FormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const { onClose, isEdit, currentReference } = props;

  const dispatch = useAppDispatch();
  const [deleteLogo, setDeleteLogo] = useState(false);
  const [localLogoFile, setLocalLogoFile] = useState<string | undefined>();
  const [inputAttachmentTypes, setInputAttachmentTypes] = useState<string[]>(
    [],
  );
  const selectedApplication = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const selectedApplicationId = getSelectedApplicationId(selectedApplication);

  const [featuresInput, setFeaturesInput] = useState(
    isEdit && selectedApplication && selectedApplication.features
      ? safeStringify(selectedApplication.features)
      : '',
  );

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const files = useAppSelector(FilesSelectors.selectFiles);
  const { t } = useTranslation(Translation.Chat);
  const inputClassName = classNames('input-form input-invalid peer mx-0');

  const applicationToPublish =
    selectedApplication && selectedApplicationId
      ? {
          name: selectedApplication.name,
          id: ApiUtils.decodeApiUrl(selectedApplicationId),
          folderId: getFolderIdFromEntityId(selectedApplication.name),
        }
      : null;

  const onLogoSelect = (filesIds: string[]) => {
    const selectedFileId = filesIds[0];
    const newFile = files.find((file) => file.id === selectedFileId);

    if (newFile) {
      const newIconUrl = constructPath('api', newFile.id);
      setDeleteLogo(false);
      setLocalLogoFile(newIconUrl);
      setValue('iconUrl', newIconUrl);
    } else {
      setLocalLogoFile(undefined);
      setValue('iconUrl', '');
    }
  };

  const onDeleteLocalLogoHandler = () => {
    setLocalLogoFile(undefined);
    setDeleteLogo(true);
    setValue('iconUrl', '');
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
  };

  const handlePublishClose = () => {
    setIsPublishing(false);
  };

  const handleDelete = useCallback(() => {
    if (selectedApplication && 'id' in selectedApplication) {
      dispatch(ApplicationActions.delete(selectedApplication));
    }
    onClose(false);
  }, [dispatch, onClose, selectedApplication]);

  const handleConfirmDialogOpen = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setIsDeleteModalOpen(true);
    },
    [setIsDeleteModalOpen],
  );

  const handleConfirmDialogClose = useCallback(
    (result: boolean) => {
      setIsDeleteModalOpen(false);

      if (result) {
        handleDelete();
      }
    },
    [handleDelete, setIsDeleteModalOpen],
  );

  function safeStringify(
    featureData: DialAIEntityFeatures | Record<string, string>,
  ) {
    if (
      typeof featureData === 'object' &&
      featureData !== null &&
      Object.keys(featureData).length === 0
    ) {
      return '';
    }
    return JSON.stringify(featureData, null, 2);
  }

  const handleAttachmentTypesChange = useCallback(
    (selectedItems: string[]) => {
      setInputAttachmentTypes(selectedItems);
      setValue('inputAttachmentTypes', selectedItems);
    },
    [setValue],
  );

  useEffect(() => {
    if (isEdit && selectedApplication) {
      if (selectedApplication.inputAttachmentTypes) {
        setInputAttachmentTypes(selectedApplication.inputAttachmentTypes);
        setValue(
          'inputAttachmentTypes',
          selectedApplication.inputAttachmentTypes,
        );
      }
      if (selectedApplication.iconUrl) {
        setLocalLogoFile(selectedApplication.iconUrl);
        setValue('iconUrl', selectedApplication.iconUrl);
      }
    } else {
      setInputAttachmentTypes([]);
      setValue('inputAttachmentTypes', []);
      setLocalLogoFile(undefined);
      setValue('iconUrl', '');
    }
  }, [isEdit, selectedApplication, setValue]);

  const validateFeaturesData = (data: string | null) => {
    if (!data || !data.trim()) {
      return true;
    }

    try {
      const object = JSON.parse(data);

      for (const [key, value] of Object.entries(object as object)) {
        if (
          typeof value === 'string' &&
          typeof key === 'string' &&
          (!key.trim() || !value.trim())
        ) {
          return t('Keys and Values should not be empty');
        }
      }
    } catch (error) {
      return t('Invalid JSON string');
    }

    return true;
  };

  const onSubmit = (data: FormData) => {
    const { ...otherFields } = data;
    const preparedData = {
      ...otherFields,
      features: featuresInput ? JSON.parse(featuresInput) : null,
      type: EntityType.Application,
      isDefault: false,
    };
    if (
      isEdit &&
      selectedApplication?.name &&
      currentReference &&
      selectedApplicationId
    ) {
      const applicationData: CustomApplicationModel = {
        ...preparedData,
        reference: currentReference,
        id: selectedApplicationId,
      };

      dispatch(
        ApplicationActions.update({
          oldApplicationId: selectedApplicationId,
          applicationData,
        }),
      );
    } else {
      dispatch(ApplicationActions.create(preparedData));
    }
    onClose(true);
  };
  return (
    <>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="relative flex max-h-full w-full grow flex-col divide-tertiary overflow-y-auto"
      >
        <button
          onClick={() => onClose(false)}
          className="absolute right-2 top-2 rounded text-secondary hover:text-accent-primary"
          data-qa="close-application-dialog"
        >
          <IconX size={24} />
        </button>
        <div className="px-3 py-4 md:px-6">
          <h2 className="text-base font-semibold">
            {isEdit ? t('Edit application') : t('Add application')}
          </h2>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-3 pb-6 md:px-6">
          <div className="flex flex-col">
            <label className="mb-1 flex text-xs text-secondary" htmlFor="name">
              {t('Name')}
              <span className="ml-1 inline text-accent-primary">*</span>
            </label>
            <input
              {...register('name', {
                required: t('This field is required') || '',
                pattern: {
                  value: new RegExp(`^[^${notAllowedSymbols}]{2,160}$`),
                  message: t(
                    'Name should be 2 to 160 characters long and should not contain special characters',
                  ),
                },
              })}
              id="name"
              defaultValue={
                isEdit && selectedApplication ? selectedApplication.name : ''
              }
              className={classNames(
                errors.name &&
                  'border-error hover:border-error focus:border-error',
                inputClassName,
              )}
              placeholder={t('Type name') || ''}
            />
            {errors.name && (
              <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
                {errors.name.message}
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="version"
            >
              {t('Version')}
              <span className="ml-1 inline text-accent-primary">*</span>
            </label>
            <input
              {...register('version', {
                required: t('This field is required') || '',
                pattern: {
                  value: /^[0-9]+\.[0-9]+\.[0-9]+$/,
                  message: t('Version number should be in the format x.y.z'),
                },
              })}
              id="version"
              defaultValue={
                isEdit && selectedApplication ? selectedApplication.version : ''
              }
              className={classNames(
                errors.version &&
                  'border-error hover:border-error focus:border-error',
                inputClassName,
              )}
              placeholder="0.0.0"
              onKeyDown={(event) => {
                if (!/[0-9.]/.test(event.key)) {
                  event.preventDefault();
                }
              }}
            />
            {errors.version && (
              <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
                {errors.version.message}
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="applicationIcon"
            >
              {t('Icon')}
              <span className="ml-1 inline text-accent-primary">*</span>
            </label>
            <Controller
              name="iconUrl"
              control={control}
              rules={{ required: t('Icon is required.') || '' }}
              render={({ field: { ref: _ref, ...restField } }) => (
                <CustomLogoSelect
                  {...restField}
                  localLogo={
                    !deleteLogo ? localLogoFile?.split('/').pop() : undefined
                  }
                  onLogoSelect={onLogoSelect}
                  onDeleteLocalLogoHandler={onDeleteLocalLogoHandler}
                  customPlaceholder={t('No icon')}
                  className="max-w-full"
                  fileManagerModalTitle="Select application icon"
                  allowedTypes={['image/svg+xml']}
                />
              )}
            />
            {!localLogoFile && errors.iconUrl && (
              <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
                {errors.iconUrl.message}
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="description"
            >
              {t('Description')}
            </label>
            <textarea
              {...register('description')}
              onBlur={() => trigger('description')}
              id="description"
              defaultValue={
                isEdit && selectedApplication
                  ? selectedApplication.description
                  : ''
              }
              rows={3}
              style={{ resize: 'none' }}
              placeholder="A description of your application"
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="featuresData"
            >
              {t('Features data')}
            </label>
            <Controller
              name="features"
              control={control}
              rules={{ validate: validateFeaturesData }}
              render={({ field }) => (
                <textarea
                  value={featuresInput}
                  onChange={(e) => {
                    setFeaturesInput(e.target.value);
                    clearErrors('features');
                  }}
                  className={inputClassName}
                  onBlur={async () => {
                    field.onChange(featuresInput);
                    await trigger('features');
                  }}
                  rows={4}
                  data-qa="features-data"
                  placeholder={`{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`}
                />
              )}
            />
            {errors.features && (
              <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
                {errors.features.message}
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="inputAttachmentTypes"
            >
              {t('Attachment types')}
            </label>
            <Controller
              name="inputAttachmentTypes"
              control={control}
              render={({ field: { ref: _ref, ...restField } }) => (
                <MultipleComboBox
                  initialSelectedItems={inputAttachmentTypes}
                  getItemLabel={getItemLabel}
                  getItemValue={getItemLabel}
                  onChangeSelectedItems={handleAttachmentTypesChange}
                  placeholder={t('Enter one or more attachment types') || ''}
                  className={classNames(
                    'flex items-start py-1 pl-0 md:order-3 md:max-w-full',
                    inputClassName,
                  )}
                  hasDeleteAll
                  itemHeight="31"
                  {...restField}
                />
              )}
            />
            {errors.inputAttachmentTypes && (
              <span>{errors.inputAttachmentTypes.message}</span>
            )}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="maxInputAttachments"
            >
              {t('Max attachments')}
            </label>
            <input
              {...register('maxInputAttachments', {
                pattern: {
                  value: /^[0-9]*$/,
                  message: t('Max attachments must be a number'),
                },
              })}
              type="text"
              defaultValue={
                isEdit && selectedApplication
                  ? selectedApplication.maxInputAttachments
                  : ''
              }
              className={classNames(inputClassName)}
              placeholder={t('Enter the maximum number of attachments') || ''}
              onKeyPress={(event) => {
                if (!/[0-9]/.test(event.key)) {
                  event.preventDefault();
                }
              }}
            />
          </div>

          <div className="mb-4 flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="completionUrl"
            >
              {t('Completion URL')}
              <span className="ml-1 inline text-accent-primary">*</span>
            </label>
            <input
              {...register('completionUrl', {
                required: t('Completion URL is required.') || '',
                validate: (value) => {
                  try {
                    new URL(value);
                    const isValid = /^https?:\/\/([\w-]+\.)+[\w-]+/.test(value);

                    if (isValid) {
                      return true;
                    }
                    return t('Completion URL should be a valid URL.') || '';
                  } catch (_) {
                    return t('Completion URL should be a valid URL.') || '';
                  }
                },
              })}
              type="text"
              defaultValue={
                isEdit && selectedApplication
                  ? selectedApplication.completionUrl
                  : ''
              }
              className={classNames(
                errors.completionUrl
                  ? 'border-error hover:border-error focus:border-error'
                  : '',
                inputClassName,
              )}
              placeholder={t('Type completion URL') || ''}
              data-qa="completion-url"
            />
            {errors.completionUrl && (
              <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
                {errors.completionUrl.message}
              </span>
            )}
          </div>
        </div>

        <div
          className={classNames(
            'flex gap-2 border-t border-primary p-4 md:px-6',
            { 'justify-between': isEdit, 'justify-end': !isEdit },
          )}
        >
          {isEdit ? (
            <div className="flex items-center gap-2">
              <Tooltip tooltip={t('Delete')}>
                <button
                  onClick={handleConfirmDialogOpen}
                  className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                  data-qa="application-delete"
                >
                  <IconTrashX
                    size={24}
                    className="shrink-0 cursor-pointer text-secondary hover:text-accent-primary"
                  />
                </button>
              </Tooltip>
              <Tooltip tooltip={t('Publish')}>
                <button
                  onClick={handlePublish}
                  className="flex size-[34px] items-center justify-center rounded text-secondary hover:bg-accent-primary-alpha hover:text-accent-primary"
                  data-qa="application-share"
                >
                  <IconWorldShare
                    size={24}
                    className="shrink-0 cursor-pointer text-secondary hover:text-accent-primary"
                  />
                </button>
              </Tooltip>
            </div>
          ) : (
            ''
          )}
          <Tooltip
            hideTooltip={isValid}
            tooltip={t('Fill in all required fields or correct values')}
          >
            <button
              className="button button-primary"
              disabled={!isValid}
              data-qa="save-application-dialog"
              type="submit"
            >
              {isEdit ? t('Save') : t('Add')}
            </button>
          </Tooltip>
        </div>
      </form>
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        heading={t('Confirm deleting application')}
        description={
          t('Are you sure you want to delete the application?') || ''
        }
        confirmLabel={t('Delete')}
        cancelLabel={t('Cancel')}
        onClose={handleConfirmDialogClose}
      />
      {applicationToPublish && (
        <PublishModal
          entity={applicationToPublish}
          type={SharingType.Application}
          isOpen={isPublishing}
          onClose={handlePublishClose}
          publishAction={
            PublishActions.ADD
            // isPublishing ? PublishActions.ADD : PublishActions.DELETE
          }
        />
      )}
    </>
  );
};

interface FormData {
  name: string;
  description: string;
  version: string;
  iconUrl: string;
  inputAttachmentTypes: string[];
  maxInputAttachments: number;
  completionUrl: string;
  features: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  isEdit?: boolean;
  selectedApplication?: CustomApplicationModel | PublicCustomApplicationModel;
  currentReference?: string;
}

const getItemLabel = (item: string) => item;

const getSelectedApplicationId = (
  selectedApplication?: CustomApplicationModel | PublicCustomApplicationModel,
) => {
  if (!selectedApplication) return undefined;
  return 'id' in selectedApplication
    ? selectedApplication.id
    : selectedApplication.application;
};

export const ApplicationDialog: React.FC<Props> = (props) => {
  const { isOpen, onClose } = props;
  const loading = useAppSelector(ApplicationSelectors.selectIsLoading);

  const handleClose = useCallback(() => {
    onClose(false);
  }, [onClose]);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleClose}
      dataQa="application-dialog"
      containerClassName="flex w-full flex-col pt-2 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
      hideClose
    >
      {loading ? (
        <div className="flex size-full h-screen items-center justify-center">
          <Spinner size={48} dataQa="publication-items-spinner" />
        </div>
      ) : (
        <ApplicationDialogView {...props} />
      )}
    </Modal>
  );
};
