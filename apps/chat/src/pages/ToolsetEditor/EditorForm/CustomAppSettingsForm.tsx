import { Input, TagInput, Textarea } from '@epam/ai-dial-kit';
import type { FC } from 'react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomAppI18nKeys } from '../../../constants/translation-keys';
import type {
  CustomAppFormData,
  CustomAppFormErrors,
} from '../../../types/custom-apps';
import {
  MIME_TYPE_REGEX,
  isValidFeaturesData,
} from '../../../utils/custom-apps';

interface Props {
  form: CustomAppFormData;
  errors: CustomAppFormErrors;
  onChange: (patch: Partial<CustomAppFormData>) => void;
}

const CustomAppSettingsForm: FC<Props> = ({ form, errors, onChange }) => {
  const { t } = useTranslation();
  const [mimeError, setMimeError] = useState<string | undefined>(undefined);
  const [featuresDataError, setFeaturesDataError] = useState<
    string | undefined
  >(undefined);

  const handleAttachmentTypesChange = useCallback(
    (inputAttachmentTypes: string[]) => {
      const hasInvalid = inputAttachmentTypes.some(
        (tag) => !MIME_TYPE_REGEX.test(tag),
      );
      setMimeError(
        hasInvalid ? t(CustomAppI18nKeys.InvalidMimeType) : undefined,
      );
      onChange({ inputAttachmentTypes });
    },
    [onChange, t],
  );

  const handleFeaturesDataChange = useCallback(
    (value: string) => {
      onChange({ featuresData: value });
      setFeaturesDataError(
        value.trim() && !isValidFeaturesData(value)
          ? t(CustomAppI18nKeys.FeaturesDataInvalid)
          : undefined,
      );
    },
    [onChange, t],
  );

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        id="custom-app-features-data"
        value={form.featuresData}
        onChange={handleFeaturesDataChange}
        labelProps={{
          label: t(CustomAppI18nKeys.FeaturesDataLabel),
          caption: t(CustomAppI18nKeys.FeaturesDataDescription),
        }}
        placeholder={t(CustomAppI18nKeys.FeaturesDataPlaceholder)}
        error={featuresDataError}
        invalid={!!featuresDataError || undefined}
        resize
      />

      <TagInput
        elementId="custom-app-attachment-types"
        label={t(CustomAppI18nKeys.AttachmentTypesLabel)}
        caption={t(CustomAppI18nKeys.AttachmentTypesDescription)}
        placeholder={t(CustomAppI18nKeys.EnterAttachmentTypes)}
        initialTags={form.inputAttachmentTypes}
        onChange={handleAttachmentTypesChange}
        invalid={!!mimeError || !!errors.inputAttachmentTypes || undefined}
        errorText={mimeError ?? errors.inputAttachmentTypes}
      />

      <Input
        id="custom-app-max-attachments"
        type="number"
        value={
          form.maxInputAttachments === ''
            ? ''
            : String(form.maxInputAttachments)
        }
        onChange={(value) => {
          const parsed = value ? parseInt(value, 10) : '';
          onChange({ maxInputAttachments: parsed });
        }}
        placeholder={t(CustomAppI18nKeys.EnterMaxAttachments)}
        labelProps={{
          label: t(CustomAppI18nKeys.MaxAttachmentsLabel),
          caption: t(CustomAppI18nKeys.MaxAttachmentsDescription),
        }}
        min={0}
      />

      <Input
        id="custom-app-completion-url"
        value={form.completionUrl}
        onChange={(value) => onChange({ completionUrl: value ?? '' })}
        labelProps={{
          label: t(CustomAppI18nKeys.CompletionUrlLabel),
          required: true,
        }}
        placeholder={t(CustomAppI18nKeys.TypeChatCompletionURL)}
        error={errors.completionUrl || undefined}
        invalid={!!errors.completionUrl || undefined}
      />
    </div>
  );
};

export default memo(CustomAppSettingsForm);
