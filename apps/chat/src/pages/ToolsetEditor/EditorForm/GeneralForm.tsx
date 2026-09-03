import type {
  DeploymentCreationFormLabels,
  DeploymentCreationFormValues,
} from '@epam/ai-dial-deployment-creation-form';
import { DeploymentCreationForm } from '@epam/ai-dial-deployment-creation-form';
import type { FC } from 'react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AvatarPickerModal from '../../../components/AvatarPickerModal/AvatarPickerModal';
import {
  EditorI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import type { CustomAppGeneralFormData } from '../../../models/custom-apps';
import type { ToolsetFormErrors } from '../../../models/toolsets';
import { resolveCatalogIconUrl } from '../../../utils/icon-path';
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
  const [isAvatarPickerOpen, setIsAvatarPickerOpen] = useState(false);

  const localeOptions = useMemo(() => buildAdditionalLocaleOptions(), []);

  const iconPreviewUrl = useMemo(
    () => resolveCatalogIconUrl(form.iconUrl),
    [form.iconUrl],
  );

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
    <>
      <DeploymentCreationForm
        values={values}
        errors={errors}
        onChange={onChange}
        onNameBlur={onNameBlur}
        onVersionBlur={onVersionBlur}
        iconPreviewUrl={iconPreviewUrl}
        onAddAvatarClick={() => setIsAvatarPickerOpen(true)}
        labels={labels}
        availableLocaleOptions={localeOptions}
      />
      <AvatarPickerModal
        isOpen={isAvatarPickerOpen}
        onClose={() => setIsAvatarPickerOpen(false)}
        onSelect={(iconUrl) => onChange({ iconUrl })}
      />
    </>
  );
};

export default memo(GeneralForm);
