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
  ConfirmationDialog,
  MARKDOWN_EDITOR_FILL_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
  mergeClasses,
  TextRefinementField,
  useAvailableHeightCap,
  useTextRefinement,
  useUnsavedChangesGuard,
  useControlErrorAssociation,
} from '@epam/ai-dial-chat-shared';
import {
  ConfirmationPopupVariant,
  DIAL_KIT_ICON_STROKE,
  ErrorMessageNotification,
  ErrorText,
  Label,
  NeutralButton,
  Spinner,
} from '@epam/ai-dial-ui-kit';
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
  onFieldChange,
  onCancel,
  onBack = onCancel,
  onDirtyChange,
  onRetry,
  onRefineDescription,
  onRefineInstructions,
  labels,
  markdownEditorTheme,
  styles: editorStyles,
}) => {
  const { colors, typography } = editorStyles ?? {};
  const contentLabelClassName =
    typography?.contentLabelClassName ?? 'dial-tiny-semi-text';
  const helperTextClassName =
    typography?.helperTextClassName ?? 'dial-small-text';

  /* The values the form was last seeded with; unsaved edits are measured against them. */
  const seededValues = useMemo<PromptEditorValues>(
    () => ({ ...EMPTY_VALUES, ...initialValues }),
    [initialValues],
  );
  const [values, setValues] = useState<PromptEditorValues>(seededValues);
  const contentLabelId = useId();
  const contentEditorId = useId();
  const contentErrorId = useId();
  useControlErrorAssociation(
    () => document.getElementById(contentEditorId),
    contentErrorId,
    Boolean(errors?.content),
  );
  const contentEditorCapRef = useAvailableHeightCap<HTMLDivElement>({
    bottomGap: CONTENT_EDITOR_BOTTOM_GAP,
    minHeight: CONTENT_EDITOR_MIN_HEIGHT,
  });

  /* Hosts that load asynchronously re-seed the form through `initialValues`. */
  useEffect(() => {
    setValues(seededValues);
  }, [seededValues]);

  const setField = useCallback(
    <K extends keyof PromptEditorValues>(
      field: K,
      value: PromptEditorValues[K],
    ) => {
      setValues((previous) => ({ ...previous, [field]: value }));
      onFieldChange?.(field, value);
    },
    [onFieldChange],
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
      if (patch.name !== undefined) onFieldChange?.('name', patch.name);
      if (patch.description !== undefined) {
        onFieldChange?.('description', patch.description);
      }
    },
    [onFieldChange],
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
  const contentRefinement = useTextRefinement({
    value: values.content,
    onChange: (content) => setField('content', content),
    onRefine: onRefineInstructions,
    disabled: isSaving,
    resetKey: initialValues,
  });
  /* One refinement per form: while either field refines, both actions and Save are disabled. */
  const isRefining =
    descriptionRefinement.isPending || contentRefinement.isPending;
  const renderRefinableDescription = onRefineDescription
    ? (textarea: ReactNode, fieldId: string) => (
        <TextRefinementField
          isEnabled
          fieldId={fieldId}
          label={labels?.descriptionLabel ?? 'Description'}
          labels={labels}
          refinement={descriptionRefinement}
          disabled={isRefining || isSaving}
        >
          {textarea}
        </TextRefinementField>
      )
    : undefined;

  const isDirty =
    values.name !== seededValues.name ||
    values.description !== seededValues.description ||
    values.content !== seededValues.content;
  /* A host that tracks dirtiness owns the guard, so the built-in one stays inert. */
  const leaveGuard = useUnsavedChangesGuard(isDirty && !onDirtyChange);
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  const { guard: guardLeave } = leaveGuard;
  const { reset: resetDescriptionRefinement } = descriptionRefinement;
  const { reset: resetContentRefinement } = contentRefinement;
  const resetRefinement = useCallback(() => {
    resetDescriptionRefinement();
    resetContentRefinement();
  }, [resetDescriptionRefinement, resetContentRefinement]);
  const handleBack = useCallback(() => {
    guardLeave(() => {
      resetRefinement();
      onBack();
    });
  }, [guardLeave, resetRefinement, onBack]);
  const handleCancel = useCallback(() => {
    guardLeave(() => {
      resetRefinement();
      onCancel();
    });
  }, [guardLeave, resetRefinement, onCancel]);

  const handleSubmit = useCallback(() => {
    if (isSaving || isRefining) return;
    onSubmit(values);
  }, [isSaving, isRefining, onSubmit, values]);

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
    '--pe-content-invalid-border': colors?.contentInvalidBorder,
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
          /* The kit Spinner is the status region; a labelled wrapper would nest a second one. */
          <div className="flex flex-1 items-center justify-center p-8">
            <Spinner ariaLabel={labels?.loadingAriaLabel ?? 'Loading prompt'} />
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
          /* The kit error section message is an assertive `alert` live region, with Retry in its `action` slot. */
          <ErrorMessageNotification
            message={
              labels?.loadErrorMessage ??
              "Couldn't load this prompt. Please try again."
            }
            textClassName={helperTextClassName}
            iconStroke={DIAL_KIT_ICON_STROKE}
            action={
              onRetry != null && (
                <NeutralButton
                  label={labels?.retryLabel ?? 'Retry'}
                  onClick={onRetry}
                />
              )
            }
          />
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

  const contentLabel = labels?.contentLabel ?? 'Instructions';
  const contentEditor = (
    <div
      ref={contentEditorCapRef}
      className={mergeClasses(
        MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
        MARKDOWN_EDITOR_FILL_HEIGHT_CLASS_NAME,
        MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
        errors?.content != null && styles.contentInvalid,
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
            labels?.contentPlaceholder ?? 'Write the prompt instructions'
          }
          theme={markdownEditorTheme}
          showDragbar={false}
        />
      </Suspense>
    </div>
  );
  const contentError = (
    <ErrorText
      id={contentErrorId}
      text={errors?.content}
      className={mergeClasses(helperTextClassName, styles.contentError)}
    />
  );

  return (
    <>
      <EntityEditor
        {...editorProps}
        onBack={handleBack}
        onCancel={handleCancel}
        isSubmitting={isSaving}
        isSubmitDisabled={isRefining}
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
              descriptionCaption={
                values.description
                  ? `${values.description.length}/${descriptionMaxLength}`
                  : undefined
              }
            />
            {onRefineInstructions ? (
              <div className="flex flex-1 flex-col" style={cssVars}>
                <TextRefinementField
                  isEnabled
                  fieldId={contentEditorId}
                  label={contentLabel}
                  labelClassName={contentLabelClassName}
                  required
                  labels={labels}
                  refinement={contentRefinement}
                  disabled={isRefining || isSaving}
                >
                  <div className="flex flex-col gap-2">
                    {contentEditor}
                    {contentError}
                  </div>
                </TextRefinementField>
              </div>
            ) : (
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
                  label={contentLabel}
                  required
                  className={contentLabelClassName}
                />
                {contentEditor}
                {contentError}
              </div>
            )}
            <span role="status" aria-live="polite" className="sr-only">
              {descriptionRemaining != null &&
                buildCounterMessage(descriptionRemaining)}
              {contentRemaining != null &&
                buildCounterMessage(contentRemaining)}
            </span>
          </>
        }
      />
      {leaveGuard.isConfirmOpen && (
        <ConfirmationDialog
          open
          title={labels?.discardTitle ?? 'Discard unsaved changes?'}
          message={
            labels?.discardMessage ??
            'You have unsaved changes. Leaving now will discard them.'
          }
          confirmLabel={labels?.discardConfirmLabel ?? 'Discard'}
          cancelLabel={labels?.discardCancelLabel ?? 'Keep editing'}
          variant={ConfirmationPopupVariant.Danger}
          onConfirm={leaveGuard.confirm}
          onClose={leaveGuard.dismiss}
        />
      )}
    </>
  );
};
