import { FileDndOverlay, AttachmentCard } from '@epam/ai-dial-attachment-input';
import {
  BuilderFormActionsOrder,
  BuilderFormContainer,
} from '@epam/ai-dial-builder-form';
import {
  buildCssVars,
  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
  mergeClasses,
  TextRefinementField,
  useAvailableHeightCap,
  useTextRefinement,
} from '@epam/ai-dial-chat-shared';
import {
  CaptionText,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ErrorText,
  FileDropzone,
  Input,
  Label,
  Spinner,
  LiveRegion,
  LiveRegionElement,
  LiveRegionPoliteness,
} from '@epam/ai-dial-ui-kit';
import { LazyMarkdownEditor } from '@epam/ai-dial-ui-kit/editors';
import { IconArrowNarrowLeft } from '@tabler/icons-react';
/*
 * Only needed once `LazyMarkdownEditor` renders. Importing it here, rather
 * than from the host's entry point, keeps this vendor CSS out of the initial
 * page load — it loads with this module, i.e. with the route-lazy page.
 */
import '@uiw/react-markdown-preview/markdown.css';
import '@uiw/react-md-editor/markdown-editor.css';
import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FC,
  type MouseEvent,
} from 'react';
import { useFileDropSurface } from '../../hooks/useFileDropSurface';
import type { ProjectCreateFormProps } from '../../models/project-create-form-props';
import {
  checkContextFiles,
  type RejectedContextFile,
} from '../../utils/context-files';
import { validateProjectName } from '../../utils/project-name';
import styles from './ProjectCreateForm.module.scss';

const MarkdownEditor = lazy(async () => {
  const module = await LazyMarkdownEditor();
  return { default: module.MarkdownEditor };
});

const DEFAULT_OPEN_FILE_LABEL = (name: string): string => `Preview ${name}`;
const DEFAULT_NAME_READ_ONLY_HINT =
  "The project name can't be changed after creation";

/** Presentational New and Edit project form: name, instructions and context files, including stored ones when editing. */
export const ProjectCreateForm: FC<ProjectCreateFormProps> = ({
  values,
  errors,
  onFieldChange,
  contextFiles,
  onContextFilesChange,
  onContextFileClick,
  selectedContextFileId,
  allowedExtensions,
  maxFileBytes,
  maxTotalBytes,
  onPickFromFileManager,
  onRefineInstructions,
  onBack,
  onCancel,
  onSubmit,
  isSubmitting = false,
  isNameReadOnly = false,
  labels,
  markdownEditorTheme,
  className,
  styles: formStyles,
}) => {
  const nameId = useId();
  const nameErrorId = useId();
  const nameValidationErrorId = useId();
  const nameHintId = useId();
  const instructionsId = useId();
  const contextLabelId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const instructionsCapRef = useAvailableHeightCap<HTMLDivElement>();
  const [isNameTouched, setIsNameTouched] = useState(false);
  const [rejections, setRejections] = useState<RejectedContextFile[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  const instructionsRefinement = useTextRefinement({
    value: values.instructions,
    onChange: (value) => onFieldChange('instructions', value),
    onRefine: onRefineInstructions,
    disabled: isSubmitting,
  });
  const isRefining = instructionsRefinement.isPending;

  const nameCheck = validateProjectName(values.name);
  const nameReadOnlyHint =
    labels.nameReadOnlyHint ?? DEFAULT_NAME_READ_ONLY_HINT;
  const nameError =
    errors.name ??
    (isNameTouched && nameCheck != null
      ? labels.nameErrors[nameCheck]
      : undefined);
  const isCreateDisabled = nameCheck != null || isSubmitting || isRefining;
  /* A host error lives in the always-mounted alert; inline validation has its own, non-announcing element. */
  let nameErrorDescribedBy: string | undefined;
  if (errors.name) nameErrorDescribedBy = nameErrorId;
  else if (nameError) nameErrorDescribedBy = nameValidationErrorId;
  const nameDescribedBy =
    [isNameReadOnly && nameHintId, nameErrorDescribedBy]
      .filter(Boolean)
      .join(' ') || undefined;

  /* A host error on Name sends focus back only when the field is editable. */
  useEffect(() => {
    if (errors.name && !isNameReadOnly) nameInputRef.current?.focus();
  }, [errors.name, isNameReadOnly]);

  const accept = useMemo(
    () => allowedExtensions.map((extension) => `.${extension}`).join(','),
    [allowedExtensions],
  );

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const { accepted, rejected } = checkContextFiles(incoming, contextFiles, {
      allowedExtensions,
      maxFileBytes,
      maxTotalBytes,
    });
    setRejections(rejected);
    if (accepted.length > 0) {
      onContextFilesChange([...contextFiles, ...accepted]);
    }
    setStatusMessage(
      [
        accepted.length > 0 ? labels.filesAddedStatus(accepted.length) : '',
        ...rejected.map(({ name, reason }) =>
          labels.fileRejections[reason](name),
        ),
      ]
        .filter(Boolean)
        .join(' '),
    );
  };

  const { isDragActive, handlers: dropSurfaceHandlers } =
    useFileDropSurface(addFiles);

  const openFileLabel = labels.openFileLabel ?? DEFAULT_OPEN_FILE_LABEL;

  const handleRemoveFile = (id: string) => {
    const removed = contextFiles.find((file) => file.id === id);
    onContextFilesChange(contextFiles.filter((file) => file.id !== id));
    setRejections([]);
    if (removed) setStatusMessage(labels.fileRemovedStatus(removed.name));
  };

  const handlePickFromFileManager = async (
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    /* The link sits inside the drop zone's label; keep the click from also opening the device picker. */
    event.preventDefault();
    event.stopPropagation();
    if (!onPickFromFileManager) return;
    try {
      const picked = await onPickFromFileManager();
      if (picked) addFiles(picked);
    } catch {
      /* The host reports its own pick failures. */
    }
  };

  const handleSubmit = () => {
    if (!isCreateDisabled) onSubmit();
  };

  const { colors, typography } = formStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const labelClassName = mergeClasses(
    typography?.labelClassName ?? 'dial-tiny-semi-text',
    styles.label,
  );
  const helperClassName = typography?.helperClassName ?? 'dial-tiny-text';
  const cssVars = buildCssVars({
    '--pcf-label-text': colors?.labelText,
    '--pcf-link-text': colors?.linkText,
    '--pcf-dropzone-bg': colors?.dropZoneBackground,
  });
  const refinementLabels = labels.refinement;
  const contextError = errors.context;
  /* The kit drop zone draws its error in the error color, below the area, and links it to the file input. */
  const dropZoneError = [
    ...rejections.map(({ name, reason }) =>
      labels.fileRejections[reason](name),
    ),
    contextError,
  ]
    .filter(Boolean)
    .join('\n');
  const dropZoneLabel = labels.dropZoneLabel({
    fromDevice: <span className={styles.link} />,
    fileManager: onPickFromFileManager ? (
      <button
        type="button"
        className={styles.link}
        disabled={isSubmitting}
        onClick={(event) => void handlePickFromFileManager(event)}
      />
    ) : undefined,
  });

  return (
    <div
      className={mergeClasses('relative flex h-full min-h-0 w-full', className)}
      {...dropSurfaceHandlers}
    >
      <FileDndOverlay
        isVisible={isDragActive}
        labels={{
          title: labels.dropOverlayTitle,
          subtitle: labels.dropOverlaySubtitle,
        }}
      />
      <BuilderFormContainer
        labels={{
          title: labels.title,
          backButtonLabel: labels.backLabel,
          cancelButtonLabel: labels.cancelLabel,
          submitButtonLabel: labels.createLabel,
          submittingLabel: labels.submittingLabel ?? labels.createLabel,
        }}
        onBack={onBack}
        onCancel={onCancel}
        onSubmit={handleSubmit}
        isCancelDisabled={isSubmitting}
        isSubmitDisabled={isCreateDisabled}
        isSubmitting={isSubmitting}
        footerActionsOrder={BuilderFormActionsOrder.SubmitFirst}
        backIcon={
          <IconArrowNarrowLeft
            size={DIAL_ICON_SIZE.LG}
            stroke={DIAL_KIT_ICON_STROKE}
            aria-hidden
            className="rtl:scale-x-[-1]"
          />
        }
        styles={{
          colors: { background: colors?.background },
          header: {
            colors: { borderColor: colors?.headerBorder },
            typography: { fontClassName: titleClassName },
          },
          cssVars,
        }}
      >
        <div
          className={mergeClasses(
            'mx-auto flex w-full max-w-262 min-w-0 flex-col gap-5 py-6',
            styles.formColumn,
          )}
        >
          <div className="flex flex-col gap-1">
            <Input
              id={nameId}
              inputRef={nameInputRef}
              value={values.name}
              onChange={(value) => {
                if (!isNameReadOnly) onFieldChange('name', value ?? '');
              }}
              onBlur={() => setIsNameTouched(true)}
              placeholder={labels.namePlaceholder}
              labelProps={{ label: labels.nameLabel, required: true }}
              required
              aria-required
              readOnly={isNameReadOnly}
              disabled={isNameReadOnly}
              tooltipText={isNameReadOnly ? nameReadOnlyHint : undefined}
              invalid={Boolean(nameError)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameDescribedBy}
            />
            {isNameReadOnly && (
              <CaptionText
                id={nameHintId}
                className={helperClassName}
                text={nameReadOnlyHint}
              />
            )}
            {/* Mounted before a host error (a taken name) arrives, so it is announced; out of the column gap while empty. Inline validation stays outside it, under its own id. */}
            <ErrorText
              announce={LiveRegionPoliteness.Assertive}
              id={nameErrorId}
              className={helperClassName}
              text={errors.name ?? ''}
            />
            {nameError && !errors.name && (
              <ErrorText
                id={nameValidationErrorId}
                className={helperClassName}
                text={nameError}
              />
            )}
          </div>

          <TextRefinementField
            isEnabled={Boolean(onRefineInstructions)}
            fieldId={instructionsId}
            label={labels.instructionsLabel}
            labelClassName={labelClassName}
            labels={refinementLabels}
            refinement={instructionsRefinement}
            disabled={isSubmitting || isRefining}
          >
            <div className="flex flex-1 flex-col gap-2">
              {!onRefineInstructions && (
                <Label
                  htmlFor={instructionsId}
                  className={labelClassName}
                  label={labels.instructionsLabel}
                />
              )}
              <div
                ref={instructionsCapRef}
                className={mergeClasses(
                  'w-full',
                  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
                  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
                )}
              >
                <Suspense
                  fallback={
                    <Spinner
                      ariaLabel={
                        labels.editorLoadingAriaLabel ?? 'Loading editor'
                      }
                    />
                  }
                >
                  <MarkdownEditor
                    id={instructionsId}
                    value={values.instructions}
                    onChange={(value) => {
                      instructionsRefinement.reset();
                      onFieldChange('instructions', value);
                    }}
                    height={176}
                    theme={markdownEditorTheme}
                    placeholder={labels.instructionsPlaceholder}
                  />
                </Suspense>
              </div>
            </div>
          </TextRefinementField>

          <section
            aria-labelledby={contextLabelId}
            className="flex flex-col gap-2"
          >
            <h2 id={contextLabelId} className={labelClassName}>
              {labels.contextLabel}
            </h2>
            <FileDropzone
              label={dropZoneLabel}
              ariaLabel={labels.dropZoneAriaLabel}
              description={labels.dropZoneHint}
              accept={accept}
              multiple
              disabled={isSubmitting}
              onChange={addFiles}
              onReject={addFiles}
              errorText={dropZoneError || undefined}
              className={styles.dropZone}
            />
            {/* Mounted before a host context error arrives, so it is announced; the drop zone shows it. Client rejections go through the status region. */}
            <LiveRegion
              visuallyHidden
              politeness={LiveRegionPoliteness.Assertive}
            >
              {contextError}
            </LiveRegion>
            {contextFiles.length > 0 && (
              <ul className="flex min-w-0 flex-wrap gap-2 pt-3">
                {contextFiles.map((file) => (
                  <li key={file.id} className="min-w-0">
                    <AttachmentCard
                      attachment={file}
                      onClick={onContextFileClick}
                      isSelected={
                        onContextFileClick == null
                          ? undefined
                          : file.id === selectedContextFileId
                      }
                      onRemove={handleRemoveFile}
                      labels={{
                        removeLabel: labels.removeFileLabel(file.name),
                        clickLabel: openFileLabel(file.name),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </BuilderFormContainer>
      <LiveRegion visuallyHidden as={LiveRegionElement.Span}>
        {isSubmitting ? labels.creatingStatus : statusMessage}
      </LiveRegion>
    </div>
  );
};
