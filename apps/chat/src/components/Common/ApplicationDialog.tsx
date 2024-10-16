import {
  IconHelp,
  IconTrashX,
  IconWorldShare,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { notAllowedSymbols } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getTopicColors } from '@/src/utils/app/style-helpers';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { DropdownSelectorOption, EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { DialAIEntityFeatures } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';

import { DEFAULT_VERSION } from '@/src/constants/public';

import Modal from '@/src/components/Common/Modal';

import { PublishModal } from '../Chat/Publish/PublishWizard';
import { CustomLogoSelect } from '../Settings/CustomLogoSelect';
import { ConfirmDialog } from './ConfirmDialog';
import { DropdownSelector } from './DropdownSelector';
import { MultipleComboBox } from './MultipleComboBox';
import { Spinner } from './Spinner';
import Tooltip from './Tooltip';

import { PublishActions } from '@epam/ai-dial-shared';
import isObject from 'lodash-es/isObject';

interface FormData {
  name: string;
  description: string;
  version: string;
  iconUrl: string;
  topics: string[];
  // capabilities: string[];
  inputAttachmentTypes: string[];
  maxInputAttachments: number | undefined;
  completionUrl: string;
  features: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  isEdit?: boolean;
  currentReference?: string;
  selectedApplication?: CustomApplicationModel;
}

const safeStringify = (
  featureData: DialAIEntityFeatures | Record<string, string> | undefined,
) => {
  if (
    !featureData ||
    (isObject(featureData) && !Object.keys(featureData).length)
  ) {
    return '';
  }

  return JSON.stringify(featureData, null, 2);
};

const getItemLabel = (item: string) => item;

const attachmentTypeRegex = new RegExp(
  '^([a-zA-Z0-9!*\\-.+]+|\\*)\\/([a-zA-Z0-9!*\\-.+]+|\\*)$',
);

const ApplicationDialogView: React.FC<Props> = ({
  onClose,
  isEdit,
  currentReference,
  selectedApplication,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    setError,
    trigger,
    control,
    formState: { errors, isValid },
  } = useForm<FormData>({
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const files = useAppSelector(FilesSelectors.selectFiles);
  const allTopics = useAppSelector(SettingsSelectors.selectTopics);

  const [deleteLogo, setDeleteLogo] = useState(false);
  const [localLogoFile, setLocalLogoFile] = useState<string | undefined>();
  const [inputAttachmentTypes, setInputAttachmentTypes] = useState<string[]>(
    [],
  );
  const [featuresInput, setFeaturesInput] = useState(
    safeStringify(selectedApplication?.features),
  );
  const [topics, setTopics] = useState<string[]>([]);
  // const [capabilities, setCapabilities] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [maxInputAttachmentsValue, setMaxInputAttachmentsValue] = useState(
    selectedApplication?.maxInputAttachments,
  );

  const topicOptions = useMemo(
    () =>
      allTopics.map((value) => ({
        value,
        label: value,
        ...getTopicColors(value),
      })),
    [allTopics],
  );

  const selectedOptions = useMemo(
    () => topicOptions.filter((op) => topics.includes(op.value)),
    [topicOptions, topics],
  );

  const inputClassName = 'input-form input-invalid peer mx-0';
  const applicationToPublish = useMemo(() => {
    if (!selectedApplication) {
      return undefined;
    }

    return {
      name: selectedApplication.name,
      id: ApiUtils.decodeApiUrl(selectedApplication.id),
      folderId: getFolderIdFromEntityId(selectedApplication.id),
      iconUrl: selectedApplication.iconUrl,
    };
  }, [selectedApplication]);

  const onLogoSelect = useCallback(
    (filesIds: string[]) => {
      const selectedFileId = filesIds[0];
      const newFile = files.find((file) => file.id === selectedFileId);

      if (newFile) {
        setDeleteLogo(false);
        setLocalLogoFile(newFile.id);
        setValue('iconUrl', newFile.id);
        trigger('iconUrl');
      } else {
        setLocalLogoFile(undefined);
        setValue('iconUrl', '');
        trigger('iconUrl');
      }
    },
    [files, setValue, trigger],
  );

  const onDeleteLocalLogoHandler = () => {
    setLocalLogoFile(undefined);
    setDeleteLogo(true);
    setValue('iconUrl', '');
    trigger('iconUrl');
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);
  };

  const handlePublishClose = () => {
    setIsPublishing(false);
  };

  const handleDelete = useCallback(() => {
    if (selectedApplication) {
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

  const handleAttachmentTypesError = useCallback(() => {
    setError('inputAttachmentTypes', {
      type: 'manual',
      message: t(`Please match the MIME format.`) || '',
    });
  }, [setError, t]);

  const handleClearAttachmentTypesError = useCallback(() => {
    clearErrors('inputAttachmentTypes');
  }, [clearErrors]);

  const handleAttachmentTypesChange = useCallback(
    (selectedItems: string[]) => {
      setInputAttachmentTypes(selectedItems);
      setValue('inputAttachmentTypes', selectedItems);
      if (inputAttachmentTypes.length < selectedItems.length) {
        trigger('inputAttachmentTypes');
      }
    },
    [inputAttachmentTypes, setValue, trigger],
  );

  useEffect(() => {
    if (selectedApplication) {
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
      setTopics(selectedApplication.topics ?? []);
      setValue('topics', selectedApplication.topics ?? []);
    } else {
      setInputAttachmentTypes([]);
      setValue('inputAttachmentTypes', []);
      setLocalLogoFile(undefined);
      setValue('iconUrl', '');
      setTopics([]);
      setValue('topics', []);
      // setCapabilities([]);
      // setValue('capabilities', []);
    }
  }, [isEdit, selectedApplication, setValue]);

  const validateFeaturesData = (data: string | null) => {
    if (!data?.trim()) {
      return true;
    }

    try {
      const object = JSON.parse(data);

      if (typeof object === 'object' && !!object && !Array.isArray(object)) {
        for (const [key, value] of Object.entries(object)) {
          if (!key.trim()) {
            return t('Keys should not be empty');
          }

          const valueType = typeof value;
          if (!(['boolean', 'number'].includes(valueType) || value === null)) {
            if (typeof value === 'string' && !value.trim()) {
              return t('String values should not be empty');
            }

            if (!['boolean', 'number', 'string'].includes(valueType)) {
              return t('Values should be a string, number, boolean or null');
            }
          }
        }
      } else {
        return t('Data is not a valid JSON object');
      }

      return true;
    } catch (error) {
      return t('Invalid JSON string');
    }
  };

  const handleChangeTopics = useCallback(
    (option: readonly DropdownSelectorOption[]) => {
      const values = option.map((option) => option.value);
      setTopics(values);
      setValue('topics', values);
    },
    [setValue],
  );

  // const handleChangeCapabilities = useCallback(
  //   (option: readonly DropdownSelectorOption[]) => {
  //     const values = option.map((option) => option.value);
  //     setCapabilities(values);
  //     setValue('capabilities', values);
  //   },
  //   [setValue],
  // );

  const handleChangeHandlerAttachments = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const newValue = event.target.value.replace(/[^0-9]/g, '');

    if (newValue === '') {
      setValue('maxInputAttachments', undefined);
    } else {
      setValue('maxInputAttachments', Number(newValue));
    }
  };

  const onSubmit = (data: FormData) => {
    const preparedData = {
      ...data,
      maxInputAttachments: maxInputAttachmentsValue,
      name: data.name.trim(),
      description: data.description.trim(),
      features: featuresInput ? JSON.parse(featuresInput) : null,
      type: EntityType.Application,
      isDefault: false,
      folderId: '',
      topics,
      // capabilities,
    };

    if (
      isEdit &&
      selectedApplication?.name &&
      currentReference &&
      selectedApplication.id
    ) {
      const applicationData: CustomApplicationModel = {
        ...preparedData,
        reference: currentReference,
        id: selectedApplication.id,
      };

      dispatch(
        ApplicationActions.update({
          oldApplicationId: selectedApplication.id,
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
              defaultValue={selectedApplication?.name}
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
                  message: t(
                    'Version should be in x.y.z format and contain only numbers and dots.',
                  ),
                },
              })}
              defaultValue={selectedApplication?.version}
              id="version"
              className={classNames(
                errors.version &&
                  'border-error hover:border-error focus:border-error',
                inputClassName,
              )}
              placeholder={DEFAULT_VERSION}
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
              htmlFor="applicationIcon"
            >
              {t('Topics')}
            </label>
            <Controller
              name="topics"
              control={control}
              render={({ field: { ref: _ref, ...restField } }) => (
                <DropdownSelector
                  {...restField}
                  placeholder={t('Select one or more topics')}
                  onChange={handleChangeTopics}
                  options={topicOptions}
                  values={selectedOptions}
                />
              )}
            />
          </div>

          {/* <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="applicationIcon"
            >
              {t('Capabilities')}
            </label>
            <Controller
              name="capabilities"
              control={control}
              render={({ field: { ref: _ref, ...restField } }) => (
                <DropdownSelector
                  {...restField}
                  placeholder={t('Select one or more capabilities')}
                  onChange={handleChangeCapabilities}
                  options={[
                    { value: 'test', label: 'Ocean' },
                    { value: 'test1', label: 'Ocean' },
                  ]}
                />
              )}
            />
            {!localLogoFile && errors.iconUrl && (
              <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
                {errors.iconUrl.message}
              </span>
            )}
          </div> */}

          <div className="flex flex-col">
            <label
              className="mb-1 flex items-center gap-1 text-xs text-secondary"
              htmlFor="description"
            >
              {t('Description')}
              <Tooltip
                tooltip={t(
                  'The first paragraph serves as a short description. To create an extended description, enter two line breaks and start the second paragraph.',
                )}
                triggerClassName="flex shrink-0 text-secondary hover:text-accent-primary"
                contentClassName="max-w-[220px]"
                placement="top"
              >
                <IconHelp size={18} />
              </Tooltip>
            </label>
            <textarea
              {...register('description')}
              onBlur={() => trigger('description')}
              id="description"
              defaultValue={selectedApplication?.description}
              rows={3}
              placeholder={t('A description of your application') || ''}
              className={classNames(inputClassName, 'resize-none')}
            />
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex items-center gap-1 text-xs text-secondary"
              htmlFor="featuresData"
            >
              {t('Features data')}
              <Tooltip
                tooltip={t(
                  'Enter key-value pairs for rate_endpoint and/or configuration_endpoint in JSON format.',
                )}
                triggerClassName="flex shrink-0 text-secondary hover:text-accent-primary"
                contentClassName="max-w-[220px]"
                placement="top"
              >
                <IconHelp size={18} />
              </Tooltip>
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
              className="mb-1 flex items-center gap-1 text-xs text-secondary"
              htmlFor="inputAttachmentTypes"
            >
              {t('Attachment types')}
              <Tooltip
                tooltip={t("Input the MIME type and press 'Enter' to add")}
                triggerClassName="flex shrink-0 text-secondary hover:text-accent-primary"
                contentClassName="max-w-[220px]"
                placement="top"
              >
                <IconHelp size={18} />
              </Tooltip>
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
                    'flex items-start py-1 pl-0 md:max-w-full',
                    inputClassName,
                  )}
                  hasDeleteAll
                  validationRegExp={attachmentTypeRegex}
                  handleError={handleAttachmentTypesError}
                  handleClearError={handleClearAttachmentTypesError}
                  hideSuggestions
                  itemHeightClassName="h-[31px]"
                  {...restField}
                />
              )}
            />
            {errors.inputAttachmentTypes && (
              <span className="text-xxs text-error peer-invalid:peer-[.submitted]:mb-1">
                {errors.inputAttachmentTypes.message}
              </span>
            )}
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex text-xs text-secondary"
              htmlFor="maxInputAttachments"
            >
              {t('Max. attachments number')}
            </label>
            <input
              {...register('maxInputAttachments', {
                pattern: {
                  value: /^[0-9]*$/,
                  message: t('Max attachments must be a number') || '',
                },
              })}
              type="text"
              value={
                maxInputAttachmentsValue === undefined
                  ? ''
                  : maxInputAttachmentsValue
              }
              className={inputClassName}
              placeholder={t('Enter the maximum number of attachments') || ''}
              onChange={(e) => {
                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                const value =
                  numericValue !== '' ? Number(numericValue) : undefined;
                if (!value || Number.isSafeInteger(value)) {
                  setMaxInputAttachmentsValue(value);
                }
                handleChangeHandlerAttachments?.(e);
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
                    if (value.trim() !== value) {
                      return (
                        t('Completion URL cannot start or end with spaces.') ||
                        ''
                      );
                    }
                    if (
                      !value.startsWith('http://') &&
                      !value.startsWith('https://')
                    ) {
                      return (
                        t(
                          'Completion URL must start with http:// or https://',
                        ) || ''
                      );
                    }
                    new URL(value);
                    const bannedEndings = ['.', '//'];
                    const endsWithBannedEnding = bannedEndings.some((ending) =>
                      value.endsWith(ending),
                    );
                    if (endsWithBannedEnding) {
                      return t('Completion URL cannot end with . or //') || '';
                    }
                    return true;
                  } catch {
                    return t('Completion URL should be a valid URL.') || '';
                  }
                },
              })}
              type="text"
              defaultValue={selectedApplication?.completionUrl}
              className={classNames(
                errors.completionUrl &&
                  'border-error hover:border-error focus:border-error',
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
            isEdit ? 'justify-between' : 'justify-end',
          )}
        >
          {isEdit && (
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
          )}
          <Tooltip
            hideTooltip={isValid}
            tooltip={t('Fill in all required fields or correct values')}
          >
            <button
              className="button button-primary"
              disabled={!isValid || !!errors.inputAttachmentTypes}
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
            isPublishing ? PublishActions.ADD : PublishActions.DELETE
          }
        />
      )}
    </>
  );
};

interface Props {
  isOpen: boolean;
  onClose: (result: boolean) => void;
  isEdit?: boolean;
  currentReference?: string;
}

export const ApplicationDialog: React.FC<Props> = ({
  isOpen,
  onClose,
  isEdit,
  currentReference,
}) => {
  const loading = useAppSelector(ApplicationSelectors.selectIsLoading);

  const selectedApplication = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );

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
        <ApplicationDialogView
          isOpen={isOpen}
          onClose={onClose}
          isEdit={isEdit}
          currentReference={currentReference}
          selectedApplication={isEdit ? selectedApplication : undefined}
        />
      )}
    </Modal>
  );
};
