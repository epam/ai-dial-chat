import type {
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
} from '@epam/ai-dial-deployment-creation-form';
import { DeploymentCreationForm } from '@epam/ai-dial-deployment-creation-form';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BasicI18nKeys,
  EditorI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import type { CustomAppGeneralFormData } from '../../../models/custom-apps';
import type { ToolsetFormErrors } from '../../../models/toolsets';
import {
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
} from '../../../utils/locale';

interface Props {
  form: CustomAppGeneralFormData;
  errors: ToolsetFormErrors;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  onChange: (patch: Partial<CustomAppGeneralFormData>) => void;
  onNameBlur?: () => void;
  onVersionBlur?: () => void;
}

const GeneralForm: FC<Props> = ({
  form,
  errors,
  namePlaceholder,
  descriptionPlaceholder,
  onChange,
  onNameBlur,
  onVersionBlur,
}) => {
  const { t } = useTranslation();

  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const labels: DeploymentCreationFormLabels = useMemo(
    () => ({
      name: {
        label: t(EditorI18nKeys.NameLabel),
        placeholder: namePlaceholder,
      },
      description: {
        label: t(EditorI18nKeys.DescriptionLabel),
        placeholder: descriptionPlaceholder,
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
        placeholder: t(ToolsetEditorI18nKeys.TopicsPlaceholder),
      },
      otherLocales: buildLocaleFieldLabels(t),
      ariaLabel: t(EditorI18nKeys.StepGeneral),
    }),
    [t, namePlaceholder, descriptionPlaceholder],
  );

  const values: DeploymentCreationFormValues = {
    name: form.name,
    description: form.description,
    iconUrl: form.iconUrl,
    version: form.version,
    topics: form.topics,
    otherLocales: form.otherLocales,
  };

  return (
    <DeploymentCreationForm
      values={values}
      errors={errors}
      onChange={onChange}
      onNameBlur={onNameBlur}
      onVersionBlur={onVersionBlur}
      labels={labels}
      availableLocaleOptions={localeOptions}
    />
  );
};

export default memo(GeneralForm);
