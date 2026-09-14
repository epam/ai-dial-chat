import { isValidFeaturesData } from '@epam/ai-dial-chat-hooks';
import {
  RESIZABLE_TEXTAREA_CLASS_NAME,
  TAG_INPUT_TAG_CLASS_NAME,
} from '@epam/ai-dial-chat-shared';
import {
  Input,
  Textarea,
  TagInput,
  TextareaResize,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MIME_TYPE_REGEX } from '../../../constants/custom-apps';
import { CustomAppI18nKeys } from '../../../constants/translation-keys';
import type {
  CustomAppFormData,
  CustomAppFormErrors,
} from '../../../models/custom-apps';

interface Props {
  form: CustomAppFormData;
  errors: CustomAppFormErrors;
  onChange: (patch: Partial<CustomAppFormData>) => void;
  onCompletionUrlBlur: () => void;
}

const CustomAppSettingsForm: FC<Props> = ({
  form,
  errors,
  onChange,
  onCompletionUrlBlur,
}) => {
  const { t } = useTranslation();

  /*
   * Validity of these two fields is a pure function of the current value, so
   * they are derived on every render instead of being cached in local state.
   * The form unmounts whenever the wizard switches back to the General step;
   * state-held errors would be dropped while the invalid value — owned by the
   * parent — survives, leaving the field silently unhighlighted on return.
   */
  const featuresDataError = useMemo(
    () =>
      form.featuresData.trim() && !isValidFeaturesData(form.featuresData)
        ? t(CustomAppI18nKeys.FeaturesDataInvalid)
        : undefined,
    [form.featuresData, t],
  );

  const mimeError = useMemo(
    () =>
      form.inputAttachmentTypes.some((tag) => !MIME_TYPE_REGEX.test(tag))
        ? t(CustomAppI18nKeys.InvalidMimeType)
        : undefined,
    [form.inputAttachmentTypes, t],
  );

  const handleAttachmentTypesChange = useCallback(
    (inputAttachmentTypes: string[]) => {
      onChange({ inputAttachmentTypes });
    },
    [onChange],
  );

  const handleFeaturesDataChange = useCallback(
    (value: string) => {
      onChange({ featuresData: value });
    },
    [onChange],
  );

  const handleCompletionUrlChange = useCallback(
    (value?: string) => {
      onChange({ completionUrl: value ?? '' });
    },
    [onChange],
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
        className={RESIZABLE_TEXTAREA_CLASS_NAME}
        resize={TextareaResize.Vertical}
      />

      <TagInput
        id="custom-app-attachment-types"
        labelProps={{
          label: t(CustomAppI18nKeys.AttachmentTypesLabel),
          caption: t(CustomAppI18nKeys.AttachmentTypesDescription),
        }}
        placeholder={t(CustomAppI18nKeys.EnterAttachmentTypes)}
        value={form.inputAttachmentTypes}
        onChange={handleAttachmentTypesChange}
        invalid={!!mimeError || !!errors.inputAttachmentTypes}
        error={mimeError ?? errors.inputAttachmentTypes}
        tagClassName={TAG_INPUT_TAG_CLASS_NAME}
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
        onChange={handleCompletionUrlChange}
        onBlur={onCompletionUrlBlur}
        labelProps={{
          label: t(CustomAppI18nKeys.CompletionUrlLabel),
          required: true,
        }}
        placeholder={t(CustomAppI18nKeys.TypeChatCompletionURL)}
        error={errors.completionUrl ?? undefined}
        invalid={!!errors.completionUrl || undefined}
      />
    </div>
  );
};

export default memo(CustomAppSettingsForm);
