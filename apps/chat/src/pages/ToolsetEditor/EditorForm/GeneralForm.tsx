import type {
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
} from '@epam/ai-dial-deployment-creation-form';
import { DeploymentCreationForm } from '@epam/ai-dial-deployment-creation-form';
import type { FC } from 'react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ToolsetEditorI18nKeys } from '../../../constants/translation-keys';
import type {
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../../types/toolsets';

interface Props {
  form: ToolsetFormData;
  errors: ToolsetFormErrors;
  onChange: (patch: Partial<ToolsetFormData>) => void;
}

const GeneralForm: FC<Props> = ({ form, errors, onChange }) => {
  const { t } = useTranslation();

  const labels: DeploymentCreationFormLabels = useMemo(
    () => ({
      name: {
        label: t(ToolsetEditorI18nKeys.NameLabel),
        placeholder: t(ToolsetEditorI18nKeys.NamePlaceholder),
      },
      description: {
        label: t(ToolsetEditorI18nKeys.DescriptionLabel),
        placeholder: t(ToolsetEditorI18nKeys.DescriptionPlaceholder),
      },
      iconUrl: {
        label: t(ToolsetEditorI18nKeys.IconUrlLabel),
        placeholder: t(ToolsetEditorI18nKeys.IconUrlPlaceholder),
      },
      version: {
        label: t(ToolsetEditorI18nKeys.VersionLabel),
        placeholder: t(ToolsetEditorI18nKeys.VersionPlaceholder),
      },
      topics: {
        label: t(ToolsetEditorI18nKeys.TopicsLabel),
        placeholder: t(ToolsetEditorI18nKeys.TopicsPlaceholder),
      },
      intro: {
        label: t(ToolsetEditorI18nKeys.IntroLabel),
        placeholder: t(ToolsetEditorI18nKeys.IntroPlaceholder),
      },
    }),
    [t],
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
