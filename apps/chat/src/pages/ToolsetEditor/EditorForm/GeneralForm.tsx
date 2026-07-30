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
} from '../../../constants/translation-keys';
import type {
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../../types/toolsets';

interface Props {
  form: ToolsetFormData;
  errors: ToolsetFormErrors;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  onChange: (patch: Partial<ToolsetFormData>) => void;
}

const GeneralForm: FC<Props> = ({
  form,
  errors,
  namePlaceholder,
  descriptionPlaceholder,
  onChange,
}) => {
  const { t } = useTranslation();

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
        placeholder: t(EditorI18nKeys.TopicsPlaceholder),
      },
      intro: {
        label: t(EditorI18nKeys.IntroLabel),
        placeholder: t(EditorI18nKeys.IntroPlaceholder),
      },
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
    intro: form.intro,
  };

  return (
    <DeploymentCreationForm
      values={values}
      errors={errors}
      onChange={onChange}
      labels={labels}
    />
  );
};

export default memo(GeneralForm);
