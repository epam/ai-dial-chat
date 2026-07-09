import type { CatalogItem } from '@epam/ai-dial-catalog';
import { Card, CatalogEntityType } from '@epam/ai-dial-catalog';
import type {
  DeploymentCreationFormFieldErrors,
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
} from '@epam/ai-dial-deployment-creation-form';
import {
  DeploymentCreationFieldErrorCode,
  DeploymentCreationForm,
  validateDeploymentCreationFields,
} from '@epam/ai-dial-deployment-creation-form';
import { NeutralButton, PrimaryButton } from '@epam/ai-dial-kit';
import { DialNotification, NotificationVariant } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppsEditorI18nKeys,
  ButtonsI18nKeys,
} from '../../constants/translation-keys';
import { createApplication } from '../../server-api/applications';

interface Props {
  schemaId: string;
  onCreated: (appId: string) => void;
  onCancel: () => void;
}

const EMPTY_VALUES: DeploymentCreationFormValues = {
  name: '',
  description: '',
  iconUrl: '',
  version: '',
  topics: [],
  intro: '',
};

const GeneralForm: FC<Props> = ({ schemaId, onCreated, onCancel }) => {
  const { t } = useTranslation();

  const [values, setValues] =
    useState<DeploymentCreationFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<DeploymentCreationFormFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const labels: DeploymentCreationFormLabels = useMemo(
    () => ({
      name: {
        label: t(AppsEditorI18nKeys.GeneralFormNameLabel),
        placeholder: t(AppsEditorI18nKeys.GeneralFormNamePlaceholder),
      },
      description: {
        label: t(AppsEditorI18nKeys.GeneralFormDescriptionLabel),
        placeholder: t(AppsEditorI18nKeys.GeneralFormDescriptionPlaceholder),
      },
      iconUrl: {
        label: t(AppsEditorI18nKeys.GeneralFormIconUrlLabel),
        placeholder: t(AppsEditorI18nKeys.GeneralFormIconUrlPlaceholder),
      },
      version: {
        label: t(AppsEditorI18nKeys.GeneralFormVersionLabel),
        placeholder: t(AppsEditorI18nKeys.GeneralFormVersionPlaceholder),
      },
      topics: {
        label: t(AppsEditorI18nKeys.GeneralFormTopicsLabel),
        placeholder: t(AppsEditorI18nKeys.GeneralFormTopicsPlaceholder),
      },
      intro: {
        label: t(AppsEditorI18nKeys.GeneralFormIntroLabel),
        placeholder: t(AppsEditorI18nKeys.GeneralFormIntroPlaceholder),
      },
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

  const handleSubmit = async () => {
    const codes = validateDeploymentCreationFields(values, {
      validateNamePattern: true,
      validateVersionPattern: true,
    });
    if (codes.name || codes.version || codes.intro) {
      let nameError: string | undefined;
      if (codes.name === DeploymentCreationFieldErrorCode.Required) {
        nameError = t(AppsEditorI18nKeys.GeneralFormNameRequired);
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
        intro: codes.intro
          ? t(AppsEditorI18nKeys.GeneralFormIntroTooLong)
          : undefined,
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const result = await createApplication({
        name: values.name.trim(),
        type: schemaId,
        description: values.description.trim() || undefined,
        iconUrl: values.iconUrl.trim() || undefined,
        version: values.version.trim() || undefined,
        topics: values.topics.length > 0 ? values.topics : undefined,
        intro: values.intro.trim() || undefined,
      });
      onCreated(result.id);
    } catch {
      setSubmitError(t(AppsEditorI18nKeys.ErrorCreateFailed));
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewItem = useMemo<CatalogItem>(
    () => ({
      id: 'preview',
      type: CatalogEntityType.Model,
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
          />

          {submitError && (
            <DialNotification
              variant={NotificationVariant.Error}
              message={submitError}
            />
          )}
        </div>

        <div className="flex shrink-0 border-t border-t-tertiary bg-layer-2 p-2">
          <div className="flex w-full justify-end gap-3">
            <NeutralButton
              type="button"
              label={t(ButtonsI18nKeys.Cancel)}
              onClick={onCancel}
              disabled={isSubmitting}
            />
            <PrimaryButton
              type="submit"
              label={t(AppsEditorI18nKeys.GeneralFormNextButton)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </div>

      <div className="flex w-1/2 flex-col bg-layer-1 p-4">
        <p className="dial-small-text text-secondary">
          {t(AppsEditorI18nKeys.GeneralFormPreviewTitle)}
        </p>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-[280px]">
            <Card item={previewItem} />
          </div>
        </div>
      </div>
    </form>
  );
};

export default memo(GeneralForm);
