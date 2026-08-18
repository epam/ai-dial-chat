import { BuilderFormContainer } from '@epam/ai-dial-builder-form';
import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  Input,
  Label,
  LazyMarkdownEditor,
  NeutralButton,
  Spinner,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import {
  lazy,
  Suspense,
  type FC,
  useCallback,
  useEffect,
  useId,
  useState,
} from 'react';
import type {
  PromptEditorProps,
  PromptEditorValues,
} from '../../models/prompt-editor-props';
import styles from './PromptEditor.module.scss';

const MarkdownEditor = lazy(async () => {
  const module = await LazyMarkdownEditor();
  return { default: module.MarkdownEditor };
});

const EMPTY_VALUES: PromptEditorValues = {
  name: '',
  description: '',
  content: '',
};

const DEFAULT_DESCRIPTION_MAX_LENGTH = 2000;
const DEFAULT_CONTENT_MAX_LENGTH = 50000;
const DEFAULT_ANNOUNCE_THRESHOLD = 10;

/** Returns the remaining character count when it is close enough to announce. */
const getRemainingCharacters = (
  value: string,
  maxLength: number,
  threshold: number,
): number | null => {
  const remaining = maxLength - value.length;
  return remaining <= threshold ? Math.max(remaining, 0) : null;
};

/** Form for authoring or editing a reusable prompt. */
export const PromptEditor: FC<PromptEditorProps> = ({
  isEditMode = false,
  initialValues,
  isLoading = false,
  hasLoadError = false,
  isSaving = false,
  errors,
  descriptionMaxLength = DEFAULT_DESCRIPTION_MAX_LENGTH,
  contentMaxLength = DEFAULT_CONTENT_MAX_LENGTH,
  counterAnnounceThreshold = DEFAULT_ANNOUNCE_THRESHOLD,
  onSubmit,
  onCancel,
  onBack = onCancel,
  onRetry,
  labels,
  markdownEditorTheme,
  styles: editorStyles,
}) => {
  const { colors, typography } = editorStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const contentLabelClassName =
    typography?.contentLabelClassName ?? 'dial-tiny-semi-text';
  const helperTextClassName =
    typography?.helperTextClassName ?? 'dial-small-text';

  const [values, setValues] = useState<PromptEditorValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const contentLabelId = useId();

  /* Hosts that load asynchronously re-seed the form through `initialValues`. */
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
  const title = isEditMode
    ? (labels?.editTitle ?? 'Edit prompt')
    : (labels?.createTitle ?? 'Create prompt');
  const cssVars = buildCssVars({
    '--pe-content-error': colors?.contentErrorText,
  });
  const containerProps = {
    labels: {
      title,
      backButtonLabel: labels?.backButtonLabel ?? 'Back to prompts',
      cancelButtonLabel: cancelLabel,
      submitButtonLabel: labels?.saveLabel ?? 'Save',
    },
    onBack,
    onCancel,
    onSubmit: handleSubmit,
    isCancelDisabled: isSaving,
    styles: {
      colors: { background: colors?.background },
      header: {
        colors: { borderColor: colors?.headerBorder },
        typography: { fontClassName: titleClassName },
      },
      cssVars,
    },
  };

  if (isLoading) {
    return (
      <BuilderFormContainer {...containerProps} isSubmitDisabled>
        <div
          role="status"
          aria-label={labels?.loadingAriaLabel ?? 'Loading prompt'}
          className="flex flex-1 items-center justify-center p-8"
        >
          <Spinner />
        </div>
      </BuilderFormContainer>
    );
  }

  if (hasLoadError) {
    return (
      <BuilderFormContainer {...containerProps} isSubmitDisabled>
        <div role="alert" className="flex flex-col items-start gap-3 p-8">
          <p className={mergeClasses('m-0', helperTextClassName)}>
            {labels?.loadErrorMessage ??
              "Couldn't load this prompt. Please try again."}
          </p>
          {onRetry != null && (
            <NeutralButton
              label={labels?.retryLabel ?? 'Retry'}
              onClick={onRetry}
            />
          )}
        </div>
      </BuilderFormContainer>
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
    <BuilderFormContainer {...containerProps} isSubmitDisabled={isSaving}>
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-5 px-4 py-6 desktop:px-8">
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

        <div
          role="group"
          aria-labelledby={contentLabelId}
          className="flex flex-1 flex-col gap-2"
        >
          <Label
            id={contentLabelId}
            label={labels?.contentLabel ?? 'Instructions'}
            required
            className={contentLabelClassName}
          />
          <Suspense
            fallback={
              <Spinner
                ariaLabel={
                  labels?.contentLoadingAriaLabel ?? 'Loading prompt editor'
                }
              />
            }
          >
            <MarkdownEditor
              value={values.content}
              onChange={(value) => setField('content', value)}
              height={480}
              placeholder={
                labels?.contentPlaceholder ?? 'Write the prompt instructions'
              }
              theme={markdownEditorTheme}
            />
          </Suspense>
          {errors?.content != null && (
            <p
              className={mergeClasses(helperTextClassName, styles.contentError)}
            >
              {errors.content}
            </p>
          )}
        </div>

        <span role="status" aria-live="polite" className="sr-only">
          {descriptionRemaining != null &&
            buildCounterMessage(descriptionRemaining)}
          {contentRemaining != null && buildCounterMessage(contentRemaining)}
        </span>
        {isSaving && (
          <span role="status" className="sr-only">
            {labels?.savingStatusLabel ?? 'Saving'}
          </span>
        )}
      </div>
    </BuilderFormContainer>
  );
};
