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
import type { ApplicationSetupProps } from '../../../models/application-editor';
import type { CustomAppFormData } from '../../../models/custom-apps';

type Props = ApplicationSetupProps<CustomAppFormData>;

const CustomAppSetup: FC<Props> = ({
  value: form,
  errors,
  onChange,
  onFieldBlur,
}) => {
  const { t } = useTranslation();

  /*
   * Validity of these two fields is a pure function of the current value, so
   * they are derived on every render instead of being cached in local state,
   * so the highlight always matches the value the page owns.
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

  const handleCompletionUrlBlur = useCallback(
    () => onFieldBlur('completionUrl'),
    [onFieldBlur],
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
        onBlur={handleCompletionUrlBlur}
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

export default memo(CustomAppSetup);
