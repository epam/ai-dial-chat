import Editor from '@monaco-editor/react';
import {
  IconHelp,
  IconTrashX,
  IconWorldShare,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  createQuickAppConfig,
  getModelDescription,
  getQuickAppConfig,
} from '@/src/utils/app/application';
import { notAllowedSymbols } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ApplicationSelectors,
} from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import { DEFAULT_VERSION } from '@/src/constants/public';

import Modal from '@/src/components/Common/Modal';

import { PublishModal } from '../Chat/Publish/PublishWizard';
import { CustomLogoSelect } from '../Settings/CustomLogoSelect';
import { ConfirmDialog } from './ConfirmDialog';
import { Spinner } from './Spinner';
import Tooltip from './Tooltip';

import { PublishActions } from '@epam/ai-dial-shared';

interface FormData {
  name: string;
  description: string;
  version: string;
  iconUrl: string;
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

const QuickAppDialogView: React.FC<Props> = ({
  onClose,
  isEdit,
  currentReference,
  selectedApplication,
}) => {
  const {
    register,
    handleSubmit,
    setValue,
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

  const [deleteLogo, setDeleteLogo] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  const [localLogoFile, setLocalLogoFile] = useState<string | undefined>();
  const [configInput, setConfigInput] = useState(
    selectedApplication ? getQuickAppConfig(selectedApplication).config : '',
  );

  const inputClassName = 'input-form input-invalid peer mx-0';

  const applicationToPublish = selectedApplication
    ? {
        name: selectedApplication.name,
        id: ApiUtils.decodeApiUrl(selectedApplication.id),
        folderId: getFolderIdFromEntityId(selectedApplication.name),
      }
    : null;

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

  useEffect(() => {
    if (selectedApplication) {
      if (selectedApplication.iconUrl) {
        setLocalLogoFile(selectedApplication.iconUrl);
        setValue('iconUrl', selectedApplication.iconUrl);
      }
    } else {
      setLocalLogoFile(undefined);
      setValue('iconUrl', '');
    }
  }, [isEdit, selectedApplication, setValue]);

  const onSubmit = (data: FormData) => {
    const preparedData = {
      ...data,
      maxInputAttachments: selectedApplication?.maxInputAttachments,
      name: data.name.trim(),
      description: createQuickAppConfig({
        description: data.description ?? '',
        config: configInput ?? '',
      }),
      features: undefined,
      type: EntityType.Application,
      isDefault: false,
      folderId: '',
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
            {isEdit ? t('Edit quick app') : t('Add quick app')}
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
              defaultValue={
                selectedApplication
                  ? getModelDescription(selectedApplication)
                  : ''
              }
              rows={3}
              placeholder={t('A description of your application') || ''}
              className={classNames(inputClassName, 'resize-none')}
            />
          </div>

          <div className="flex flex-col">
            <label
              className="mb-1 flex items-center gap-1 text-xs text-secondary"
              htmlFor="config"
            >
              {t('Quick app configuration')}
            </label>

            <Editor
              height={200}
              options={{
                minimap: {
                  enabled: false,
                },
                padding: {
                  top: 12,
                  bottom: 12,
                },
              }}
              className="m-0.5 w-full overflow-hidden rounded border border-primary"
              defaultLanguage="json"
              language="yaml"
              defaultValue={configInput}
              onChange={(value) => setConfigInput(value ?? '')}
              theme="vs-dark"
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
                    const isValid =
                      /^(https?):\/\/([\w.-]+)?(:\d{2,5})?(\/.*)?$/i.test(
                        value,
                      );
                    if (isValid) {
                      return true;
                    }
                  } catch {
                    return t('Completion URL should be a valid URL.') || '';
                  }
                  return t('Completion URL should be a valid URL.') || '';
                },
              })}
              type="text"
              defaultValue={selectedApplication?.completionUrl}
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
          publishAction={PublishActions.ADD}
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

export const QuickAppDialog: React.FC<Props> = ({
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
      dataQa="quick-app-dialog"
      containerClassName="flex w-full flex-col pt-2 md:grow-0 xl:max-w-[720px] 2xl:max-w-[780px]"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
      hideClose
    >
      {loading ? (
        <div className="flex size-full h-screen items-center justify-center">
          <Spinner size={48} dataQa="publication-items-spinner" />
        </div>
      ) : (
        <QuickAppDialogView
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
