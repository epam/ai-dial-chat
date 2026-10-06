import {
  DEFAULT_METADATA_FORM_LABELS,
  EntityEditor,
  MetadataField,
  MetadataForm,
  type DeploymentCreationFormValues,
  type MetadataFormLabels,
} from '@epam/ai-dial-builder-form';
import {
  buildCssVars,
  MARKDOWN_EDITOR_FILL_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
  mergeClasses,
  TextRefinementField,
  useAvailableHeightCap,
  useTextRefinement,
} from '@epam/ai-dial-chat-shared';
import { Label, NeutralButton, Spinner } from '@epam/ai-dial-ui-kit';
import { LazyMarkdownEditor } from '@epam/ai-dial-ui-kit/editors';
/*
 * Only needed once `LazyMarkdownEditor` actually renders (below). Importing
 * it here, rather than eagerly from the host app's entry point, keeps this
 * vendor CSS out of the initial page load — it loads only when this module
 * does, i.e. when the (already route-lazy) prompt editor page mounts.
 */
import '@uiw/react-markdown-preview/markdown.css';
import '@uiw/react-md-editor/markdown-editor.css';
import {
  lazy,
  Suspense,
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { PROMPT_EDITOR_CLASS } from '../../constants/public-class-names';
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

const METADATA_FIELDS = [MetadataField.Name, MetadataField.Description];

const DEFAULT_DESCRIPTION_MAX_LENGTH = 2000;
const DEFAULT_CONTENT_MAX_LENGTH = 50000;
const DEFAULT_ANNOUNCE_THRESHOLD = 10;

/* One centred column holding Name, Description and Instructions. */
const FORM_CLASS_NAME =
  'mx-auto w-full max-w-[1180px] gap-5 px-4 py-6 desktop:px-8 desktop:py-6';

/*
 * Instructions fill the form down to the bottom of the screen. The gap matches
 * the form's `py-6`, so the filled editor ends on the form's padding.
 */
const CONTENT_EDITOR_BOTTOM_GAP = 24;

/* The editor's previous fixed height; filling never shrinks it below that. */
const CONTENT_EDITOR_MIN_HEIGHT = 480;

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
  onRefineDescription,
  labels,
  markdownEditorTheme,
  styles: editorStyles,
}) => {
  const { colors, typography } = editorStyles ?? {};
  const contentLabelClassName =
    typography?.contentLabelClassName ?? 'dial-tiny-semi-text';
  const helperTextClassName =
    typography?.helperTextClassName ?? 'dial-small-text';

  const [values, setValues] = useState<PromptEditorValues>({
    ...EMPTY_VALUES,
    ...initialValues,
  });
  const contentLabelId = useId();
  const contentEditorId = useId();
  const contentEditorCapRef = useAvailableHeightCap<HTMLDivElement>({
    bottomGap: CONTENT_EDITOR_BOTTOM_GAP,
    minHeight: CONTENT_EDITOR_MIN_HEIGHT,
  });

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

  /* MetadataForm edits the shared deployment shape; the prompt keeps only Name and Description. */
  const metadataValues = useMemo<DeploymentCreationFormValues>(
    () => ({
      name: values.name,
      description: values.description,
      iconUrl: '',
      version: '',
      topics: [],
      otherLocales: [],
    }),
    [values.name, values.description],
  );

  const handleMetadataChange = useCallback(
    (patch: Partial<DeploymentCreationFormValues>) => {
      setValues((previous) => ({
        ...previous,
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.description !== undefined && {
          description: patch.description,
        }),
      }));
    },
    [],
  );

  const metadataErrors = useMemo(
    () => ({ name: errors?.name, description: errors?.description }),
    [errors?.name, errors?.description],
  );

  const metadataLabels = useMemo<MetadataFormLabels>(
    () => ({
      form: {
        ...DEFAULT_METADATA_FORM_LABELS,
        name: {
          label: labels?.nameLabel ?? 'Name',
          placeholder: labels?.namePlaceholder ?? 'Prompt name',
        },
        description: {
          label: labels?.descriptionLabel ?? 'Description',
          placeholder:
            labels?.descriptionPlaceholder ?? 'What this prompt is for',
        },
        // The fields sit in the prompt form itself, not in a separately named group.
        ariaLabel: undefined,
      },
    }),
    [
      labels?.nameLabel,
      labels?.namePlaceholder,
      labels?.descriptionLabel,
      labels?.descriptionPlaceholder,
    ],
  );

  const descriptionRefinement = useTextRefinement({
    value: values.description,
    onChange: (description) => setField('description', description),
    onRefine: onRefineDescription,
    disabled: isSaving,
    resetKey: initialValues,
  });
  const renderRefinableDescription = onRefineDescription
    ? (textarea: ReactNode, fieldId: string) => (
        <TextRefinementField
          isEnabled
          fieldId={fieldId}
          label={labels?.descriptionLabel ?? 'Description'}
          labels={labels}
          refinement={descriptionRefinement}
          disabled={descriptionRefinement.isPending || isSaving}
        >
          {textarea}
        </TextRefinementField>
      )
    : undefined;

  const handleSubmit = useCallback(() => {
    if (isSaving || descriptionRefinement.isPending) return;
    onSubmit(values);
  }, [isSaving, descriptionRefinement.isPending, onSubmit, values]);

  /* MetadataForm moves focus to an invalid Name or Description itself; this
   * covers the case where only Instructions is invalid. Focus moves only when
   * that error appears, so editing with the error shown never steals focus. */
  const isOnlyContentInvalid =
    errors?.content != null && !errors?.name && !errors?.description;
  const wasOnlyContentInvalidRef = useRef(false);
  useEffect(() => {
    if (isOnlyContentInvalid && !wasOnlyContentInvalidRef.current) {
      document.getElementById(contentEditorId)?.focus();
    }
    wasOnlyContentInvalidRef.current = isOnlyContentInvalid;
  }, [isOnlyContentInvalid, contentEditorId]);

  const title = isEditMode
    ? (labels?.editTitle ?? 'Edit prompt')
    : (labels?.createTitle ?? 'Create prompt');
  const submitLabel = isEditMode
    ? (labels?.saveLabel ?? 'Save')
    : (labels?.createLabel ?? 'Create');

  const editorLabels = useMemo(
    () => ({
      cancelLabel: labels?.cancelLabel ?? 'Cancel',
      backAriaLabel: labels?.backButtonAriaLabel ?? 'Back to prompts',
      savingStatusLabel: labels?.savingStatusLabel ?? 'Saving',
    }),
    [
      labels?.cancelLabel,
      labels?.backButtonAriaLabel,
      labels?.savingStatusLabel,
    ],
  );

  const cssVars = buildCssVars({
    '--pe-content-error': colors?.contentErrorText,
  });

  const editorProps = {
    title,
    onBack,
    onCancel,
    onSubmit: handleSubmit,
    submitLabel,
    labels: editorLabels,
    metadataTitle: null,
  };

  if (isLoading) {
    return (
      <EntityEditor
        {...editorProps}
        isSubmitting={isSaving}
        metadata={
          <div
            role="status"
            aria-label={labels?.loadingAriaLabel ?? 'Loading prompt'}
            className="flex flex-1 items-center justify-center p-8"
          >
            <Spinner />
          </div>
        }
      />
    );
  }

  if (hasLoadError) {
    return (
      <EntityEditor
        {...editorProps}
        metadata={
          <div role="alert" className="flex flex-col items-start gap-3">
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
        }
      />
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
    <EntityEditor
      {...editorProps}
      isSubmitting={isSaving}
      isSubmitDisabled={descriptionRefinement.isPending}
      metadataSectionClassName={mergeClasses(
        FORM_CLASS_NAME,
        PROMPT_EDITOR_CLASS.form,
      )}
      metadata={
        <>
          <MetadataForm
            values={metadataValues}
            errors={metadataErrors}
            onChange={handleMetadataChange}
            fields={METADATA_FIELDS}
            renderDescription={renderRefinableDescription}
            labels={metadataLabels}
          />
          <div
            role="group"
            aria-labelledby={contentLabelId}
            className="flex flex-1 flex-col gap-2"
            style={cssVars}
          >
            {/*
             * htmlFor is what names the editor's textarea; without it the
             * label is only visible text sitting above an unnamed control.
             */}
            <Label
              id={contentLabelId}
              htmlFor={contentEditorId}
              label={labels?.contentLabel ?? 'Instructions'}
              required
              className={contentLabelClassName}
            />
            <div
              ref={contentEditorCapRef}
              className={mergeClasses(
                MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
                MARKDOWN_EDITOR_FILL_HEIGHT_CLASS_NAME,
                MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
              )}
            >
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
                  id={contentEditorId}
                  value={values.content}
                  onChange={(value) => setField('content', value)}
                  height={480}
                  placeholder={
                    labels?.contentPlaceholder ??
                    'Write the prompt instructions'
                  }
                  theme={markdownEditorTheme}
                />
              </Suspense>
            </div>
            {errors?.content != null && (
              <p
                className={mergeClasses(
                  helperTextClassName,
                  styles.contentError,
                )}
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
        </>
      }
    />
  );
};
