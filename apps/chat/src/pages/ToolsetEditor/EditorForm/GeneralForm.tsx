import { DialInput, DialTagInput, DialTextarea } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo } from 'react';
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

  return (
    <div className="flex flex-col gap-4">
      <DialInput
        id="toolset-name"
        value={form.name}
        onChange={(value) => onChange({ name: value ?? '' })}
        labelProps={{
          label: t(ToolsetEditorI18nKeys.NameLabel),
          required: true,
        }}
        placeholder={t(ToolsetEditorI18nKeys.NamePlaceholder)}
        error={errors.name || undefined}
        invalid={!!errors.name}
      />

      <DialTextarea
        id="toolset-description"
        value={form.description}
        onChange={(value) => onChange({ description: value })}
        labelProps={{ label: t(ToolsetEditorI18nKeys.DescriptionLabel) }}
        placeholder={t(ToolsetEditorI18nKeys.DescriptionPlaceholder)}
      />

      <DialInput
        id="toolset-icon-url"
        value={form.iconUrl}
        onChange={(value) => onChange({ iconUrl: value ?? '' })}
        labelProps={{ label: t(ToolsetEditorI18nKeys.IconUrlLabel) }}
        placeholder={t(ToolsetEditorI18nKeys.IconUrlPlaceholder)}
      />

      <DialInput
        id="toolset-version"
        value={form.version}
        onChange={(value) => onChange({ version: value ?? '' })}
        labelProps={{ label: t(ToolsetEditorI18nKeys.VersionLabel) }}
        placeholder={t(ToolsetEditorI18nKeys.VersionPlaceholder)}
      />

      <DialTagInput
        elementId="toolset-topics"
        label={t(ToolsetEditorI18nKeys.TopicsLabel)}
        placeholder={t(ToolsetEditorI18nKeys.TopicsPlaceholder)}
        initialTags={form.topics}
        onChange={(topics) => onChange({ topics })}
      />
    </div>
  );
};

export default memo(GeneralForm);
