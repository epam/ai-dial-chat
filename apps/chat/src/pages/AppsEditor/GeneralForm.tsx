import type { CatalogItem } from '@epam/ai-dial-catalog';
import { Card, CatalogEntityType } from '@epam/ai-dial-catalog';
import {
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
import {
  AppsEditorI18nKeys,
  BasicI18nKeys,
  EditorI18nKeys,
} from '../../constants/translation-keys';
import { createApplication } from '../../server-api/applications';
import type { TriggerSaveGeneralPayload } from '../../types/apps-editor';
import { isQuickAppSchema } from '../../utils/application-schema';
import {
  appendLocaleCode,
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
  composeLocalePayload,
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

  const [values, setValues] =
    useState<DeploymentCreationFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<DeploymentCreationFormFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const hasSeededInitialValuesRef = useRef(false);

  useEffect(() => {
    if (hasSeededInitialValuesRef.current || !initialValues) return;
    hasSeededInitialValuesRef.current = true;
    setValues(normalizeFormValues(initialValues));
  }, [initialValues]);

  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

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
        label: t(EditorI18nKeys.IconUrlLabel),
        placeholder: t(BasicI18nKeys.UrlPlaceholder),
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

  const getValues = useCallback(
    (): TriggerSaveGeneralPayload => ({
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      iconUrl: values.iconUrl.trim() || undefined,
      topics: values.topics.length > 0 ? values.topics : undefined,
      display_version: values.version.trim() || undefined,
    }),
    [values],
  );

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
      iconUrl: values.iconUrl.trim() || undefined,
    }),
    [values],
  );

  return (
    <form
      noValidate
      className="flex h-full w-full"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex h-full w-1/2 flex-col border-e border-e-tertiary">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <DeploymentCreationForm
            values={values}
            errors={errors}
            onChange={handleChange}
            labels={labels}
            availableLocaleOptions={localeOptions}
          />

          {submitError && <ErrorMessageNotification message={submitError} />}
        </div>
      </div>

      <div className="flex w-1/2 flex-col bg-layer-1 p-4">
        <p className="dial-small-text text-secondary">
          {t(BasicI18nKeys.Preview)}
        </p>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-[280px]">
            <Card item={previewItem} />
          </div>
        </div>
      </div>
    </form>
  );
});

export default memo(GeneralForm);
