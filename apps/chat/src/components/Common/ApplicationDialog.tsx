import { IconX } from '@tabler/icons-react';
import {
  ChangeEvent,
  FocusEvent,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  doesHaveDotsInTheEnd,
  isEntityNameOnSameLevelUnique,
  prepareEntityName,
} from '@/src/utils/app/common';
import { onBlur } from '@/src/utils/app/style-helpers';

import { CreateApplicationModel } from '@/src/types/applications';
import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import Modal from '@/src/components/Common/Modal';

import { CustomLogoSelect } from '../Settings/CustomLogoSelect';
import EmptyRequiredInputMessage from './EmptyRequiredInputMessage';
import { MultipleComboBox } from './MultipleComboBox';
import Tooltip from './Tooltip';

interface Props {
  isOpen: boolean;
  onClose: (result: boolean) => void;
}

export const ApplicationDialog = ({ isOpen, onClose }: Props) => {
  const dispatch = useAppDispatch();
  const allPrompts = useAppSelector(PromptsSelectors.selectPrompts);
  const { t } = useTranslation(Translation.PromptBar);
  const [name, setName] = useState<string>('');
  const [version, setVersion] = useState('');
  const [versionHasFocus, setVersionHasFocus] = useState<boolean>(false);
  const [featuresDataHasFocus, setFeaturesDataHasFocus] =
    useState<boolean>(false);
  const [description, setDescription] = useState('');
  const [deleteLogo, setDeleteLogo] = useState<boolean>(false);
  const [localLogoFile, setLocalLogoFile] = useState<string | undefined>();
  const files = useAppSelector(FilesSelectors.selectFiles);
  const customLogoId = useAppSelector(UISelectors.selectCustomLogo);
  const featuresDataInputRef = useRef<HTMLTextAreaElement>(null);
  const [featuresData, setFeaturesData] = useState<string>('');
  const [featuresDataError, setFeaturesDataError] = useState<string>('');
  const [maxAttachments, setMaxAttachments] = useState('');
  const [completionUrl, setCompletionUrl] = useState<string>('');
  const [completionUrlError, setCompletionUrlError] = useState<string>('');
  const [isConfirmDialog, setIsConfirmDialog] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [iconError, setIconError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filterParams, setFilterParams] = useState<string[]>([]);
  interface FormData extends CreateApplicationModel {}

  const [formData, setFormData] = useState<FormData>({
    endpoint: '',
    display_name: '',
    display_version: '',
    icon_url: '',
    description: '',
    features: {
      rate_endpoint: '',
      configuration_endpoint: '',
    },
    input_attachment_types: [],
    max_input_attachments: 0,
    defaults: {},
  });

  const resetForm = () => {
    setName('');
    setVersion('');
    setDescription('');
    setFeaturesData('');
    setMaxAttachments('');
    setCompletionUrl('');
    setLocalLogoFile(undefined);
    setDeleteLogo(false);
    setFilterParams([]);
    setFormData({
      endpoint: '',
      display_name: '',
      display_version: '',
      icon_url: '',
      description: '',
      features: {
        rate_endpoint: '',
        configuration_endpoint: '',
      },
      input_attachment_types: [],
      max_input_attachments: 0,
      defaults: {},
    });
  };

  const getItemLabel = (item: string) => item;
  const handleChangeFilterParams = useCallback(
    (filterParams: string[]) => {
      setFilterParams(filterParams);
      setFormData({ ...formData, input_attachment_types: filterParams });
    },
    [formData],
  );

  const handleClose = useCallback(() => {
    setSubmitted(false);
    resetForm();
    onClose(false);
  }, [onClose]);

  const nameOnBlurHandler = (e: FocusEvent<HTMLInputElement>) => {
    const newName = prepareEntityName(e.target.value.trim(), { forRenaming: true });
    const pattern = /^[^!@#$^*()+]{3,160}$/;
  
    if (!pattern.test(newName)) {
      setNameError(
        'Name should be 3 to 160 characters long and should not contain special characters',
      );
    } else {
      setNameError(null);
    }
    setFormData({ ...formData, display_name: newName });
    setName(newName);
    onBlur(e);
  };

  const nameOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    const pattern = /^[^!@#$^*()+]*$/;

    if (!pattern.test(newName)) {
      setNameError("You can't type special characters");
    } else {
      setName(newName);
      setNameError(null);
    }

    setFormData({ ...formData, display_name: newName });
  };

  const versionOnChangeHandler = (e: ChangeEvent<HTMLInputElement>) => {
    const newVersion = e.target.value.trim();
    setFormData({ ...formData, display_version: newVersion });
    const partialPattern = /^[0-9]+(\.[0-9]*)*$/;
    if (partialPattern.test(newVersion) || newVersion === '') {
      setVersion(newVersion);
      setVersionError(null);
    }
  };

  const versionOnBlurHandler = () => {
    if (!/^[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
      setVersionError('Version number should be in the format x.y.z');
    }
    setVersionHasFocus(false);
  };

  const featuresDataBlurHandler = () => {
    const value = featuresData.trim();
    try {
      const parsedJson = JSON.parse(value);
      for (let [key, value] of Object.entries(parsedJson)) {
        if (
          typeof key !== 'string' ||
          key.trim() === '' ||
          typeof value !== 'string' ||
          value.trim() === ''
        ) {
          throw new Error('Empty Key or Value');
        }
      }
      setFormData({ ...formData, features: parsedJson });
      setFeaturesDataError('');
    } catch (e) {
      let error = e as Error;
      if (error.message === 'Empty Key or Value') {
        setFeaturesDataError('Keys and Values should not be empty');
      } else {
        setFeaturesDataError(
          'Value should be in proper JSON format with at least one key-value pair',
        );
      }
    }
    setFeaturesDataHasFocus(false);
  };

  const descriptionOnChangeHandler = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setFormData({ ...formData, description: e.target.value });
  };

  const handleMaxAttachmentsChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (event.target.value === '' || /^\d*$/.test(event.target.value)) {
      setMaxAttachments(event.target.value);
      setFormData({
        ...formData,
        max_input_attachments: Number(event.target.value),
      });
    }
  };

  const handleCompletionUrlChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setCompletionUrl(event.target.value);
    setFormData({ ...formData, endpoint: event.target.value });
  };

  const handleSubmit = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const applicationName = name;
    const applicationData = formData;
    dispatch(ApplicationActions.create({ applicationName, applicationData }));
    handleClose();
    resetForm();
};

  const handleEnter = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        console.log(formData);
      }
    },
    [formData],
  );

  const featuresDataOnChangeHandler = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    try {
      const parsedJson = JSON.parse(value);
      if (Object.keys(parsedJson).length < 1) {
        throw new Error('Empty JSON');
      }
      if (
        Object.values(parsedJson).some(
          (value) => typeof value === 'string' && value.trim() === '',
        )
      ) {
        throw new Error('Empty Value');
      }
      setFeaturesDataError('');
    } catch (e) {
      let error = e as Error;
      if (error.message === 'Empty JSON') {
        setFeaturesDataError(
          'Features data should have at least one key-value pair',
        );
      } else if (error.message === 'Empty Value') {
        setFeaturesDataError('Values in Feature data should not be empty');
      } else {
        setFeaturesDataError('Features data should be in JSON format');
      }
    }
    setFeaturesData(value);
  };

  const onLogoSelect = (filesIds: string[]) => {
    setDeleteLogo(false);
    const selectedFileId = filesIds[0];
    const newFile = files.find((file) => file.id === selectedFileId);
    setLocalLogoFile(newFile?.name || '');
    setFormData({ ...formData, icon_url: newFile?.name || '' });
  };

  const onDeleteLocalLogoHandler = () => {
    setLocalLogoFile(undefined);
    setDeleteLogo(true);
    setFormData({ ...formData, icon_url: '' });
  };

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (customLogoId) {
      const file = files.find((file) => file.id === customLogoId);
      setLocalLogoFile(file?.name || '');
      setFormData({ ...formData, icon_url: file?.name || '' });
    }
  }, [customLogoId, files]);

  const inputClassName = classNames('input-form', 'mx-0', 'peer', {
    'input-invalid': submitted,
    submitted: submitted,
  });

  const saveDisabled = !name.trim() || !version.trim() || !localLogoFile;
  console.log(saveDisabled, !name.trim(), !version.trim(), !localLogoFile);

  return (
    <Modal
      portalId="theme-main"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={handleClose}
      dataQa="application-dialog"
      containerClassName="flex flex-col min-h-[579px] md:h-[747px] sm:w-[525px] w-full"
      dismissProps={{ outsidePressEvent: 'mousedown' }}
      hideClose
      initialFocus={nameInputRef}
    >
      <button
        onClick={handleClose}
        className="absolute right-2 top-2 rounded text-secondary hover:text-accent-primary"
        data-qa="close-application-dialog"
      >
        <IconX height={24} width={24} />
      </button>
      <div className="px-3 py-4 md:pl-4 md:pr-10">
        <h2 className="text-base font-semibold">{t('Add application')}</h2>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto">
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="promptName"
          >
            {t('Name')}
            <span className="ml-1 inline text-accent-primary">*</span>
          </label>
          <input
            ref={nameInputRef}
            name="promptName"
            className={classNames(
              nameError && 'border-error hover:border-error focus:border-error',
              inputClassName,
            )}
            placeholder={t('Type name') || ''}
            value={name}
            required
            type="text"
            onFocus={() => setNameError(null)}
            onBlur={nameOnBlurHandler}
            onChange={nameOnChangeHandler}
            data-qa="prompt-name"
          />
          {nameError && <EmptyRequiredInputMessage isShown text={nameError} />}
        </div>
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="applicationVersion"
          >
            {t('Version')}
            <span className="ml-1 inline text-accent-primary">*</span>
          </label>
          <input
            name="applicationVersion"
            className={classNames(
              versionError && !versionHasFocus
                ? 'border-error hover:border-error focus:border-error'
                : '',
              inputClassName,
            )}
            placeholder={t('0.0.0') || ''}
            value={version}
            required
            type="text"
            onFocus={() => setVersionHasFocus(true)}
            onBlur={() => versionOnBlurHandler()}
            onChange={versionOnChangeHandler}
            data-qa="application-version"
          />
          {versionError && !versionHasFocus && (
            <EmptyRequiredInputMessage isShown text={versionError} />
          )}
        </div>
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="applicationIcon"
          >
            {t('Icon')}
            <span className="ml-1 inline text-accent-primary">*</span>
          </label>
          <CustomLogoSelect
            onLogoSelect={onLogoSelect}
            onDeleteLocalLogoHandler={onDeleteLocalLogoHandler}
            localLogo={!deleteLogo ? localLogoFile : undefined}
            customPlaceholder="No icon"
            hasLeftText={false}
            className="max-w-full"
          />
          <EmptyRequiredInputMessage
            isShown={!!iconError}
            text={iconError || ''}
          />
        </div>
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="description"
          >
            {t('Description')}
          </label>
          <textarea
            ref={descriptionInputRef}
            name="description"
            className={inputClassName}
            style={{ resize: 'none' }}
            placeholder={t('A description for your prompt.') || ''}
            value={description}
            onChange={descriptionOnChangeHandler}
            rows={3}
            data-qa="prompt-descr"
          />
        </div>
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="featuresData"
          >
            {t('Features data')}
          </label>
          <textarea
            ref={featuresDataInputRef}
            name="featuresData"
            className={classNames(
              featuresDataError && !featuresDataHasFocus
                ? 'border-error hover:border-error focus:border-error'
                : '',
              inputClassName,
            )}
            style={{ resize: 'none' }}
            placeholder={`{\n\t"rate_endpoint": "http://application1/rate",\n\t"configuration_endpoint": "http://application1/configuration"\n}`}
            value={featuresData}
            rows={4}
            onFocus={() => setFeaturesDataHasFocus(true)}
            onBlur={featuresDataBlurHandler}
            onChange={featuresDataOnChangeHandler}
            data-qa="features-data"
          />
          {featuresDataError && (
            <EmptyRequiredInputMessage isShown text={featuresDataError} />
          )}
        </div>
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="attachmentTypes"
          >
            {t('Attachment types')}
          </label>
          <MultipleComboBox
            initialSelectedItems={filterParams}
            getItemLabel={getItemLabel}
            getItemValue={getItemLabel}
            onChangeSelectedItems={handleChangeFilterParams}
            placeholder={t('Enter one or more attachment types') as string}
            customClass={classNames(
              'flex items-start py-1 pl-0',
              inputClassName,
            )}
            hasDeleteAll={true}
            itemHeight="31"
          />
        </div>
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="maxAttachments"
          >
            {t('Max attachments')}
          </label>
          <input
            name="maxAttachments"
            className={classNames(inputClassName)}
            placeholder={t('Enter the maximum number of attachments') || ''}
            value={maxAttachments}
            type="text"
            onChange={handleMaxAttachmentsChange}
            data-qa="max-attachments"
          />
        </div>
        <div className="flex flex-col px-3 md:px-5">
          <label
            className="mb-1 flex text-xs text-secondary"
            htmlFor="completionUrl"
          >
            {t('Completion URL')}
          </label>
          <input
            name="completionUrl"
            className={classNames(
              completionUrlError
                ? 'border-error hover:border-error focus:border-error'
                : '',
              inputClassName,
            )}
            placeholder={t('Enter the completion URL') || ''}
            value={completionUrl}
            type="text"
            onFocus={() => setCompletionUrlError('')}
            onChange={handleCompletionUrlChange}
            data-qa="completion-url"
          />
          {completionUrlError && (
            <EmptyRequiredInputMessage isShown text={completionUrlError} />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-primary p-4 md:px-5">
        <Tooltip
          hideTooltip={!saveDisabled}
          tooltip={t('Enter all required fields')}
        >
          <button
            className="button button-primary"
            onClick={handleSubmit}
            onKeyPress={handleEnter}
            disabled={saveDisabled}
            data-qa="save-application-dialog"
          >
            {t('Create')}
          </button>
        </Tooltip>
      </div>
    </Modal>
  );
};
