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
import type { CustomAppGeneralFormData } from '../../../models/custom-apps';
import type { ToolsetFormErrors } from '../../../models/toolsets';
import {
  appendLocaleCode,
  buildAdditionalLocaleOptions,
  buildLocaleFieldLabels,
  PRIMARY_LOCALE,
} from '../../../utils/locale';

interface Props {
  form: CustomAppGeneralFormData;
  errors: ToolsetFormErrors;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  onChange: (patch: Partial<CustomAppGeneralFormData>) => void;
}

const GeneralForm: FC<Props> = ({
  form,
  errors,
  namePlaceholder,
  descriptionPlaceholder,
  onChange,
}) => {
  const { t } = useTranslation();

  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const labels: DeploymentCreationFormLabels = useMemo(
    () => ({
      name: {
        label: appendLocaleCode(t(EditorI18nKeys.NameLabel), PRIMARY_LOCALE),
        placeholder: namePlaceholder,
      },
      description: {
        label: appendLocaleCode(
          t(EditorI18nKeys.DescriptionLabel),
          PRIMARY_LOCALE,
        ),
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
      labels={labels}
      availableLocaleOptions={localeOptions}
    />
  );
};

export default memo(GeneralForm);
