import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  ElementSize,
  Input,
  NeutralButton,
  PrimaryButton,
  Spinner,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type {
  PromptEditorProps,
  PromptEditorValues,
} from '../../models/prompt-editor-props';
import { PromptFolderField } from '../PromptFolderField/PromptFolderField';

const EMPTY_VALUES: PromptEditorValues = {
  name: '',
  description: '',
  content: '',
  folderId: '',
};

const DEFAULT_DESCRIPTION_MAX_LENGTH = 2000;
const DEFAULT_CONTENT_MAX_LENGTH = 50000;
const DEFAULT_ANNOUNCE_THRESHOLD = 10;

/**
 * Returns how many characters are left before `maxLength`, or `null` while the
 * value is still further away than `threshold` — announcing on every keystroke
 * would be unusable noise.
 */
const getRemainingCharacters = (
  value: string,
  maxLength: number,
  threshold: number,
): number | null => {
  const remaining = maxLength - value.length;
  return remaining <= threshold ? Math.max(remaining, 0) : null;
};

/** Form for authoring or editing a reusable prompt, including its folder. */
export const PromptEditor: FC<PromptEditorProps> = ({
  isEditMode = false,
  initialValues,
  folders,
  isLoading = false,
  hasLoadError = false,
  isSaving = false,
  errors,
  descriptionMaxLength = DEFAULT_DESCRIPTION_MAX_LENGTH,
  contentMaxLength = DEFAULT_CONTENT_MAX_LENGTH,
  counterAnnounceThreshold = DEFAULT_ANNOUNCE_THRESHOLD,
  onSubmit,
  onCancel,
  onRetry,
  folderActions,
  isFolderReadOnly = false,
  folderNameError,
  labels,
  styles,
}) => {
  const {
    titleClassName = 'dial-h1-text',
    helperTextClassName = 'dial-small-text',
  } = styles?.typography ?? {};

  const [values, setValues] = useState<PromptEditorValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });

  /*
   * Hosts that load an existing prompt hand over `initialValues` only once the
   * fetch settles, so the fields are re-seeded whenever that object changes.
   */
  useEffect(() => {
    setValues({ ...EMPTY_VALUES, ...initialValues });
  }, [initialValues]);

  const setField = useCallback(
    <K extends keyof PromptEditorValues>(
      field: K,
      value: PromptEditorValues[K],
    ) => {
      setValues((previous) => ({ ...previous, [field]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(() => {
    if (isSaving) return;
    onSubmit(values);
  }, [isSaving, onSubmit, values]);

  const cancelLabel = labels?.cancelLabel ?? 'Cancel';

  if (isLoading) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
        <h1 className={mergeClasses('mb-6', titleClassName)}>
          {isEditMode
            ? (labels?.editTitle ?? 'Edit prompt')
            : (labels?.createTitle ?? 'Create prompt')}
        </h1>
        <div
          role="status"
          aria-label={labels?.loadingAriaLabel ?? 'Loading prompt'}
          className="flex items-center gap-2"
        >
          <Spinner />
        </div>
      </main>
    );
  }

  if (hasLoadError) {
    return (
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
        <h1 className={mergeClasses('mb-6', titleClassName)}>
          {labels?.editTitle ?? 'Edit prompt'}
        </h1>
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className={mergeClasses('m-0', helperTextClassName)}>
            {labels?.loadErrorMessage ??
              "Couldn't load this prompt. Please try again."}
          </p>
          <div className="flex gap-2">
            {onRetry != null && (
              <NeutralButton
                label={labels?.retryLabel ?? 'Retry'}
                onClick={onRetry}
              />
            )}
            <NeutralButton label={cancelLabel} onClick={onCancel} />
          </div>
        </div>
      </main>
    );
  }

  const descriptionRemaining = getRemainingCharacters(
    values.description,
    descriptionMaxLength,
    counterAnnounceThreshold,
  );
  const contentRemaining = getRemainingCharacters(
    values.content,
    contentMaxLength,
    counterAnnounceThreshold,
  );
  const buildCounterMessage = (count: number) =>
    labels?.charactersRemaining?.(count) ?? `${count} characters remaining`;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <h1 className={mergeClasses('mb-6', titleClassName)}>
        {isEditMode
          ? (labels?.editTitle ?? 'Edit prompt')
          : (labels?.createTitle ?? 'Create prompt')}
      </h1>

      <form
        className="flex max-w-[720px] flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <Input
          id="prompt-name"
          value={values.name}
          labelProps={{ label: labels?.nameLabel ?? 'Name', required: true }}
          placeholder={labels?.namePlaceholder ?? 'Prompt name'}
          invalid={errors?.name != null}
          error={errors?.name}
          onChange={(value) => setField('name', value ?? '')}
        />

        <Textarea
          id="prompt-description"
          value={values.description}
          labelProps={{ label: labels?.descriptionLabel ?? 'Description' }}
          placeholder={
            labels?.descriptionPlaceholder ?? 'What this prompt is for'
          }
          invalid={errors?.description != null}
          error={errors?.description}
          onChange={(value) => setField('description', value)}
        />

        <Textarea
          id="prompt-content"
          value={values.content}
          resize
          labelProps={{
            label: labels?.contentLabel ?? 'Prompt',
            required: true,
          }}
          placeholder={labels?.contentPlaceholder ?? 'Write the prompt text'}
          invalid={errors?.content != null}
          error={errors?.content}
          onChange={(value) => setField('content', value)}
        />

        <PromptFolderField
          value={values.folderId}
          folders={folders}
          error={errors?.folder}
          nameError={folderNameError}
          actions={folderActions}
          disabled={isFolderReadOnly}
          labels={labels}
          helperTextClassName={helperTextClassName}
          onChange={(folderId) => setField('folderId', folderId)}
        />

        {/*
         * Only announced within the last few characters of a limit — a live
         * region that fires on every keystroke is unusable noise.
         */}
        <span role="status" aria-live="polite" className="sr-only">
          {descriptionRemaining != null &&
            buildCounterMessage(descriptionRemaining)}
          {contentRemaining != null && buildCounterMessage(contentRemaining)}
        </span>

        <div className="flex gap-2">
          <PrimaryButton
            type="submit"
            size={ElementSize.Standard}
            label={labels?.saveLabel ?? 'Save'}
            disabled={isSaving}
          />
          <NeutralButton
            type="button"
            size={ElementSize.Standard}
            label={cancelLabel}
            disabled={isSaving}
            onClick={onCancel}
          />
          {isSaving && (
            <span role="status" className="sr-only">
              {labels?.savingStatusLabel ?? 'Saving'}
            </span>
          )}
        </div>
      </form>
    </main>
  );
};
