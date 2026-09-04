import type { CatalogItem } from '@epam/ai-dial-catalog';
import { Card } from '@epam/ai-dial-catalog';
import {
  appendLocaleCode,
  composeLocalePayload,
  dialFileToAttachment,
  isQuickAppSchema,
} from '@epam/ai-dial-chat-hooks';
import type { AttachResult } from '@epam/ai-dial-chat-shared';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import {
  AvatarPickerModal,
  DeploymentCreationFieldErrorCode,
  DeploymentCreationForm,
  DeploymentCreationFormFieldErrors,
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
  validateDeploymentCreationFields,
} from '@epam/ai-dial-deployment-creation-form';
import { ErrorMessageNotification } from '@epam/ai-dial-ui-kit';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import DialFileManagerModal from '../../components/DialFileManagerModal/DialFileManagerModal';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_FILE_SIZE_BYTES,
} from '../../constants/files';
import {
  AppsEditorI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  DialFileManagerI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { createApplication } from '../../server-api/applications';
import type { TriggerSaveGeneralPayload } from '../../types/apps-editor';
import { resolveCatalogIconUrl } from '../../utils/icon-path';
import {
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
  PRIMARY_LOCALE,
} from '../../utils/locale';

export interface GeneralFormHandle {
  submit: () => Promise<void>;
  /**
   * Current in-memory General-step values, normalized (trimmed). Includes
   * `display_version`; excludes the backend `version` field.
   */
  getValues: () => TriggerSaveGeneralPayload;
}

export interface GeneralFormInitialValues {
  name?: string;
  description?: string;
  iconUrl?: string;
  version?: string;
  topics?: string[];
  otherLocales?: DeploymentCreationFormValues['otherLocales'];
}

interface Props {
  schemaId: string;
  /** Id of the app being edited. When set, submitting advances to the next step instead of creating a new app. */
  appId?: string;
  /** Existing app values used to prefill the form when editing an app. */
  initialValues?: GeneralFormInitialValues;
  onCreated: (appId: string, displayName?: string, iconUrl?: string) => void;
}

const EMPTY_VALUES: DeploymentCreationFormValues = {
  name: '',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  otherLocales: [],
};

const normalizeFormValues = (
  values: Partial<DeploymentCreationFormValues>,
): DeploymentCreationFormValues => ({
  name: values.name ?? '',
  description: values.description ?? '',
  iconUrl: values.iconUrl ?? '',
  version: values.version ?? '',
  topics: values.topics ?? [],
  otherLocales: values.otherLocales ?? [],
});

const GeneralForm = forwardRef<GeneralFormHandle, Props>(function GeneralForm(
  { schemaId, appId, initialValues, onCreated },
  ref,
) {
  const { t } = useTranslation();
  const { user } = useUser();
  const bucket = user?.bucket ?? '';

  const [values, setValues] =
    useState<DeploymentCreationFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<DeploymentCreationFormFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);
  const hasSeededInitialValuesRef = useRef(false);

  useEffect(() => {
    if (hasSeededInitialValuesRef.current || !initialValues) return;
    hasSeededInitialValuesRef.current = true;
    setValues(normalizeFormValues(initialValues));
  }, [initialValues]);

  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const iconPreviewUrl = useMemo(
    () => resolveCatalogIconUrl(values.iconUrl),
    [values.iconUrl],
  );

  const labels: DeploymentCreationFormLabels = useMemo(
    () => ({
      name: {
        label: appendLocaleCode(t(EditorI18nKeys.NameLabel), PRIMARY_LOCALE),
        placeholder: t(AppsEditorI18nKeys.GeneralFormNamePlaceholder),
      },
      description: {
        label: appendLocaleCode(
          t(EditorI18nKeys.DescriptionLabel),
          PRIMARY_LOCALE,
        ),
        placeholder: t(AppsEditorI18nKeys.GeneralFormDescriptionPlaceholder),
      },
      iconUrl: {
        label: t(EditorI18nKeys.AvatarLabel),
        addAvatarLabel: t(EditorI18nKeys.AddAvatarButtonLabel),
        captionText: t(EditorI18nKeys.AvatarCaption),
      },
      version: {
        label: t(EditorI18nKeys.VersionLabel),
        placeholder: t(EditorI18nKeys.VersionPlaceholder),
      },
      topics: {
        label: t(EditorI18nKeys.TopicsLabel),
        placeholder: t(EditorI18nKeys.TopicsPlaceholder),
      },
      otherLocales: buildLocaleFieldLabels(t),
      ariaLabel: t(EditorI18nKeys.StepGeneral),
    }),
    [t],
  );

  const avatarPickerLabels = useMemo(
    () => ({
      title: t(EditorI18nKeys.AddAvatarButtonLabel),
      attachLabel: t(DialFileManagerI18nKeys.Attach),
      emptyTitle: t(DialFileManagerI18nKeys.Empty),
      emptyDescription: '',
      errorMessage: t(DialFileManagerI18nKeys.Error),
      retryLabel: t(DialFileManagerI18nKeys.Retry),
      hiddenFilesLabel: t(DialFileManagerI18nKeys.HiddenFiles),
      showHiddenFilesLabel: t(DialFileManagerI18nKeys.ShowHiddenFiles),
      hideHiddenFilesLabel: t(DialFileManagerI18nKeys.HideHiddenFiles),
      getSelectionLabel: (count: number) =>
        t(DialFileManagerI18nKeys.ItemsSelected, { count }),
      uploadFilesLabel: t(DialFileManagerI18nKeys.Upload),
      newFolderLabel: t(DialFileManagerI18nKeys.NewFolder),
      downloadLabel: t(ButtonsI18nKeys.Download),
      downloadingLabel: t(DialFileManagerI18nKeys.Downloading),
      deleteLabel: t(ButtonsI18nKeys.Delete),
      deletingLabel: t(DialFileManagerI18nKeys.DeletingLabel),
      deleteConfirmTitleSingle: t(
        DialFileManagerI18nKeys.DeleteConfirmTitleSingle,
      ),
      deleteConfirmTitleMultiple: t(
        DialFileManagerI18nKeys.DeleteConfirmTitleMultiple,
      ),
      deleteConfirmSingleText: t(BasicI18nKeys.DeleteConfirmDescription),
      deleteConfirmMultipleText: t(
        DialFileManagerI18nKeys.DeleteConfirmBodyMultiple,
      ),
      deleteConfirmItemsLabel: t(
        DialFileManagerI18nKeys.DeleteConfirmBodyItems,
      ),
      deleteConfirmLabel: t(ButtonsI18nKeys.Delete),
      deleteCancelLabel: t(ButtonsI18nKeys.Cancel),
      uploadProgressTitle: t(DialFileManagerI18nKeys.UploadProgressTitle),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
    }),
    [t],
  );

  const handleChange = (patch: Partial<DeploymentCreationFormValues>) => {
    setValues((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) {
        delete next[key as keyof DeploymentCreationFormFieldErrors];
      }
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setErrors({});
    const codes = validateDeploymentCreationFields(values, {
      validateNamePattern: true,
      validateVersionPattern: true,
    });
    if (codes.name || codes.version) {
      let nameError: string | undefined;
      if (codes.name === DeploymentCreationFieldErrorCode.Required) {
        nameError = t(EditorI18nKeys.NameRequired);
      } else if (
        codes.name === DeploymentCreationFieldErrorCode.InvalidFormat
      ) {
        nameError = t(AppsEditorI18nKeys.GeneralFormNameInvalid);
      }

      setErrors({
        name: nameError,
        version: codes.version
          ? t(AppsEditorI18nKeys.GeneralFormVersionInvalid)
          : undefined,
      });
      return;
    }

    if (appId) {
      onCreated(appId, values.name.trim(), values.iconUrl.trim() || undefined);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const applicationProperties = isQuickAppSchema({ id: schemaId })
        ? {
            orchestrator: {
              system_prompt: { type: 'custom', variables: {}, content: '' },
            },
            contexts: [],
            tool_sets: [],
          }
        : undefined;
      const locales = composeLocalePayload(values.otherLocales, PRIMARY_LOCALE);
      const result = await createApplication({
        name: values.name.trim(),
        type: schemaId,
        description: values.description.trim() || undefined,
        iconUrl: values.iconUrl.trim() || undefined,
        version: values.version.trim() || undefined,
        topics: values.topics.length > 0 ? values.topics : undefined,
        applicationProperties,
        locales,
        primaryLocale: locales ? PRIMARY_LOCALE : undefined,
      });
      onCreated(
        result.id,
        values.name.trim(),
        values.iconUrl.trim() || undefined,
      );
    } catch {
      setSubmitError(t(AppsEditorI18nKeys.ErrorCreateFailed));
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, values, appId, t, onCreated, schemaId]);

  const getValues = useCallback((): TriggerSaveGeneralPayload => {
    const locales = composeLocalePayload(values.otherLocales, PRIMARY_LOCALE);
    return {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      iconUrl: values.iconUrl.trim() || undefined,
      topics: values.topics.length > 0 ? values.topics : undefined,
      display_version: values.version.trim() || undefined,
      locales,
      primaryLocale: locales ? PRIMARY_LOCALE : undefined,
    };
  }, [values]);

  useImperativeHandle(ref, () => ({ submit: handleSubmit, getValues }), [
    handleSubmit,
    getValues,
  ]);

  const previewItem = useMemo<CatalogItem>(
    () => ({
      id: 'preview',
      type: CatalogEntityType.Agent,
      name: values.name,
      version: values.version,
      lastUsed: '',
      description: values.description,
      folder: [],
      topics: values.topics,
      iconUrl: iconPreviewUrl,
    }),
    [values, iconPreviewUrl],
  );

  return (
    <form
      noValidate
      className="flex h-full w-full flex-col overflow-y-auto desktop:flex-row desktop:overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex w-full flex-col border-b border-b-tertiary desktop:h-full desktop:w-1/2 desktop:border-b-0 desktop:border-e desktop:border-e-tertiary">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 desktop:p-6">
          <DeploymentCreationForm
            values={values}
            errors={errors}
            onChange={handleChange}
            iconPreviewUrl={iconPreviewUrl}
            onAddAvatarClick={() => setIsAvatarPickerOpen(true)}
            labels={labels}
            availableLocaleOptions={localeOptions}
          />
          <AvatarPickerModal
            isOpen={isAvatarPickerOpen}
            onClose={() => setIsAvatarPickerOpen(false)}
            onAttach={(result: AttachResult) => {
              const [file] = result.files;
              const attachment = file
                ? dialFileToAttachment(file, bucket, {
                    resolvePreviewUrl: resolveCatalogIconUrl,
                  })
                : null;
              if (attachment?.url) {
                handleChange({ iconUrl: attachment.url });
              }
              setIsAvatarPickerOpen(false);
            }}
            bucket={bucket}
            FileManagerModal={DialFileManagerModal}
            allowedMimeTypes={AVATAR_ALLOWED_MIME_TYPES}
            maxFileSizeBytes={AVATAR_MAX_FILE_SIZE_BYTES}
            labels={avatarPickerLabels}
          />

          {submitError && <ErrorMessageNotification message={submitError} />}
        </div>
      </div>

      <div className="flex w-full flex-col bg-layer-sunken p-4 desktop:w-1/2">
        <p className="dial-small-text text-secondary">
          {t(BasicI18nKeys.Preview)}
        </p>
        <div className="flex flex-1 items-center justify-center py-4">
          <div className="w-full max-w-[280px]">
            <Card item={previewItem} />
          </div>
        </div>
      </div>
    </form>
  );
});

export default memo(GeneralForm);
