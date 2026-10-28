import { FileDndOverlay, AttachmentCard } from '@epam/ai-dial-attachment-input';
import { BuilderFormContainer } from '@epam/ai-dial-builder-form';
import {
  buildCssVars,
  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
  mergeClasses,
  TextRefinementField,
  useAvailableHeightCap,
  useTextRefinement,
  type TextRefinementCallback,
} from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  ErrorText,
  FileDropzone,
  Input,
  Label,
  Spinner,
  Textarea,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { LazyMarkdownEditor } from '@epam/ai-dial-ui-kit/editors';
import { IconArrowNarrowLeft, IconPlus } from '@tabler/icons-react';
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
  type ChangeEvent,
  type FC,
} from 'react';
import { useFileDropSurface } from '../../hooks/useFileDropSurface';
import type { ProjectCreateFormProps } from '../../models/project-create-form-props';
import {
  checkContextFiles,
  getContextFilesSize,
  type RejectedContextFile,
} from '../../utils/context-files';
import { validateProjectName } from '../../utils/project-name';
import { ProjectCapacityMeter } from '../ProjectCapacityMeter/ProjectCapacityMeter';
import styles from './ProjectCreateForm.module.scss';

const MarkdownEditor = lazy(async () => {
  const module = await LazyMarkdownEditor();
  return { default: module.MarkdownEditor };
});

const ADD_FROM_DEVICE_KEY = 'device';
const ADD_FROM_FILE_MANAGER_KEY = 'file-manager';

/** Presentational New project form: name, description, instructions and context files. */
export const ProjectCreateForm: FC<ProjectCreateFormProps> = ({
  values,
  errors,
  onFieldChange,
  contextFiles,
  onContextFilesChange,
  allowedExtensions,
  maxFileBytes,
  maxTotalBytes,
  onPickFromFileManager,
  onRefineDescription,
  onRefineInstructions,
  onBack,
  onCancel,
  onSubmit,
  isSubmitting = false,
  labels,
  markdownEditorTheme,
  className,
  styles: formStyles,
}) => {
  const nameId = useId();
  const nameErrorId = useId();
  const descriptionId = useId();
  const instructionsId = useId();
  const contextLabelId = useId();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const deviceInputRef = useRef<HTMLInputElement>(null);
  const instructionsCapRef = useAvailableHeightCap<HTMLDivElement>();
  const [isNameTouched, setIsNameTouched] = useState(false);
  const [rejections, setRejections] = useState<RejectedContextFile[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  /* At most one refinement may be pending per form, as in the scheduled-task
   * form: a second Refine is rejected as an abort while the first runs. */
  const refinementLock = useRef<AbortSignal | undefined>(undefined);
  const guardRefinement = (
    callback?: TextRefinementCallback,
  ): TextRefinementCallback | undefined =>
    callback
      ? async (value, signal) => {
          if (refinementLock.current && !refinementLock.current.aborted)
            throw new DOMException('Busy', 'AbortError');
          refinementLock.current = signal;
          try {
            return await callback(value, signal);
          } finally {
            if (refinementLock.current === signal)
              refinementLock.current = undefined;
          }
        }
      : undefined;
  const descriptionRefinement = useTextRefinement({
    value: values.description,
    onChange: (value) => onFieldChange('description', value),
    onRefine: guardRefinement(onRefineDescription),
    disabled: isSubmitting,
  });
  const instructionsRefinement = useTextRefinement({
    value: values.instructions,
    onChange: (value) => onFieldChange('instructions', value),
    onRefine: guardRefinement(onRefineInstructions),
    disabled: isSubmitting,
  });
  const isRefining =
    descriptionRefinement.isPending || instructionsRefinement.isPending;

  const nameCheck = validateProjectName(values.name);
  const nameError =
    errors.name ??
    (isNameTouched && nameCheck != null
      ? labels.nameErrors[nameCheck]
      : undefined);
  const isCreateDisabled = nameCheck != null || isSubmitting || isRefining;

  /* A host error on Name (a taken name) sends focus back to the field. */
  useEffect(() => {
    if (errors.name) nameInputRef.current?.focus();
  }, [errors.name]);

  const usedBytes = useMemo(
    () => getContextFilesSize(contextFiles),
    [contextFiles],
  );
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

  const handleRemoveFile = (id: string) => {
    const removed = contextFiles.find((file) => file.id === id);
    onContextFilesChange(contextFiles.filter((file) => file.id !== id));
    setRejections([]);
    if (removed) setStatusMessage(labels.fileRemovedStatus(removed.name));
  };

  const handleDeviceInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handlePickFromFileManager = async () => {
    if (!onPickFromFileManager) return;
    try {
      const picked = await onPickFromFileManager();
      if (picked) addFiles(picked);
    } catch {
      /* The host reports its own pick failures. */
    }
  };

  const addItems: DropdownItem[] = [
    {
      key: ADD_FROM_DEVICE_KEY,
      label: labels.addFromDeviceLabel,
      onClick: () => deviceInputRef.current?.click(),
    },
    ...(onPickFromFileManager
      ? [
          {
            key: ADD_FROM_FILE_MANAGER_KEY,
            label: labels.addFromFileManagerLabel,
            onClick: () => void handlePickFromFileManager(),
          },
        ]
      : []),
  ];

  const handleSubmit = () => {
    if (
      !isCreateDisabled &&
      (!refinementLock.current || refinementLock.current.aborted)
    )
      onSubmit();
  };

  const { colors, typography } = formStyles ?? {};
  const titleClassName = typography?.titleClassName ?? 'dial-h1-text';
  const labelClassName = typography?.labelClassName ?? 'dial-body-semi-text';
  const helperClassName = typography?.helperClassName ?? 'dial-tiny-text';
  const cssVars = buildCssVars({
    '--pcf-helper-text': colors?.helperText,
    '--pcf-meter-track': colors?.meterTrack,
    '--pcf-meter-fill': colors?.meterFill,
  });
  const refinementLabels = labels.refinement;
  const contextError = errors.context;
  const isContextInvalid = Boolean(contextError);

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
            'mx-auto flex w-full max-w-[996px] min-w-0 flex-col gap-5 py-6',
            styles.formColumn,
          )}
        >
          <div className="flex flex-col gap-1">
            <Input
              id={nameId}
              inputRef={nameInputRef}
              value={values.name}
              onChange={(value) => onFieldChange('name', value ?? '')}
              onBlur={() => setIsNameTouched(true)}
              placeholder={labels.namePlaceholder}
              labelProps={{ label: labels.nameLabel, required: true }}
              required
              aria-required
              invalid={Boolean(nameError)}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? nameErrorId : undefined}
            />
            {nameError && (
              <ErrorText
                id={nameErrorId}
                role={errors.name ? 'alert' : undefined}
                className={helperClassName}
                text={nameError}
              />
            )}
          </div>

          <TextRefinementField
            isEnabled={Boolean(onRefineDescription)}
            fieldId={descriptionId}
            label={labels.descriptionLabel}
            labelClassName={labelClassName}
            labels={refinementLabels}
            refinement={descriptionRefinement}
            disabled={isSubmitting || isRefining}
          >
            <Textarea
              id={descriptionId}
              value={values.description}
              onChange={(value) => {
                descriptionRefinement.reset();
                onFieldChange('description', value);
              }}
              placeholder={labels.descriptionPlaceholder}
              labelProps={
                onRefineDescription
                  ? undefined
                  : { label: labels.descriptionLabel }
              }
            />
          </TextRefinementField>

          <TextRefinementField
            isEnabled={Boolean(onRefineInstructions)}
            fieldId={instructionsId}
            label={labels.instructionsLabel}
            labelClassName={labelClassName}
            labels={refinementLabels}
            refinement={instructionsRefinement}
            disabled={isSubmitting || isRefining}
          >
            <div className="flex flex-1 flex-col gap-1">
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
                <Suspense fallback={<Spinner />}>
                  <MarkdownEditor
                    id={instructionsId}
                    value={values.instructions}
                    onChange={(value) => {
                      instructionsRefinement.reset();
                      onFieldChange('instructions', value);
                    }}
                    height={360}
                    theme={markdownEditorTheme}
                    placeholder={labels.instructionsPlaceholder}
                  />
                </Suspense>
              </div>
            </div>
          </TextRefinementField>

          <section
            aria-labelledby={contextLabelId}
            className="flex flex-col gap-3"
          >
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h2 id={contextLabelId} className={labelClassName}>
                {labels.contextLabel}
              </h2>
              <ButtonDropdown
                items={addItems}
                label={labels.addLabel}
                variant={ButtonVariant.Primary}
                appearance={ButtonAppearance.Ghost}
                disabled={isSubmitting}
                iconBefore={
                  <IconPlus
                    size={DIAL_ICON_SIZE.SM}
                    stroke={DIAL_KIT_ICON_STROKE}
                    aria-hidden
                  />
                }
              />
            </div>
            <input
              ref={deviceInputRef}
              type="file"
              multiple
              accept={accept}
              tabIndex={-1}
              aria-hidden
              className="sr-only"
              onChange={handleDeviceInputChange}
            />
            <FileDropzone
              label={labels.dropZoneLabel}
              description={labels.dropZoneHint}
              accept={accept}
              multiple
              disabled={isSubmitting}
              onChange={addFiles}
              onReject={addFiles}
            />
            {(rejections.length > 0 || isContextInvalid) && (
              <ul
                className={mergeClasses(
                  'flex flex-col gap-1',
                  helperClassName,
                  styles.helper,
                )}
              >
                {rejections.map(({ name, reason }) => (
                  <li key={`${reason}:${name}`}>
                    {labels.fileRejections[reason](name)}
                  </li>
                ))}
                {isContextInvalid && <li role="alert">{contextError}</li>}
              </ul>
            )}
            {contextFiles.length > 0 && (
              <ul className="flex min-w-0 flex-wrap gap-2">
                {contextFiles.map((file) => (
                  <li key={file.id} className="min-w-0">
                    <AttachmentCard
                      attachment={file}
                      onRemove={handleRemoveFile}
                      labels={{
                        removeLabel: labels.removeFileLabel(file.name),
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
            <ProjectCapacityMeter
              usedBytes={usedBytes}
              maxBytes={maxTotalBytes}
              ariaLabel={labels.capacityMeterLabel}
              formatLabel={labels.capacityLabel}
              textClassName={helperClassName}
            />
          </section>
        </div>
      </BuilderFormContainer>
      <span role="status" aria-live="polite" className="sr-only">
        {isSubmitting ? labels.creatingStatus : statusMessage}
      </span>
    </div>
  );
};
