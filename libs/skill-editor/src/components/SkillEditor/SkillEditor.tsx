import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import { EditorLayout } from '@epam/ai-dial-editor-builder';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { DialFoldersTree } from '@epam/ai-dial-react-file-manager';
import {
  Accordion,
  CaptionText,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EditorThemes,
  ErrorText,
  GhostButton,
  Input,
  LazyMarkdownEditor,
  NeutralButton,
  PrimaryButton,
  Spinner,
  Textarea,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { IconPlus, IconTrashX } from '@tabler/icons-react';
import {
  ComponentType,
  FC,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSkillFileDropZone } from '../../hooks/useSkillFileDropZone';
import type {
  SkillEditorProps,
  SkillEditorValues,
  SkillFileTreeNode,
} from '../../models/skill-editor-props';
import { SKILL_MANIFEST_PATH } from '../../types/skill-editor-defaults';
import { SkillFileNodeKind } from '../../types/skill-file-node-kind';
import { buildDialFileTree } from '../../utils/file-tree';
import { SkillFileDropOverlay } from '../SkillFileDropOverlay/SkillFileDropOverlay';
import { SkillFileUploadDialog } from '../SkillFileUploadDialog/SkillFileUploadDialog';
import styles from './SkillEditor.module.scss';

type MarkdownEditorComponent = ComponentType<{
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  theme?: EditorThemes;
}>;

const LazyMarkdown = lazy(async () => {
  const { MarkdownEditor } = await LazyMarkdownEditor();
  return { default: MarkdownEditor as MarkdownEditorComponent };
});

/** Host-agnostic form for authoring a DIAL Skill's manifest and supporting files. */
export const SkillEditor: FC<SkillEditorProps> = ({
  initialValues,
  files,
  selectedPath: controlledSelectedPath,
  onSelectedPathChange,
  expandedPaths: controlledExpandedPaths,
  onExpandedPathsChange,
  isLoading = false,
  hasLoadError = false,
  isSubmitting = false,
  errors,
  submitError,
  conflict,
  onReloadLatest,
  isNameReadOnly = false,
  onDirtyChange,
  fileActions,
  supportingFileContent,
  onSubmit,
  onCancel,
  onBack,
  backAriaLabel,
  title,
  onRetry,
  labels,
  styles: stylesProp,
  dir,
  instructionsEditorTheme = EditorThemes.light,
}) => {
  const [values, setValues] = useState<SkillEditorValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    instructions: initialValues?.instructions ?? '',
  });
  const seededInitialValuesRef = useRef(initialValues);
  const isReseeding = seededInitialValuesRef.current !== initialValues;
  const seededFilesRef = useRef<SkillFileTreeNode[]>(files);
  useEffect(() => {
    seededInitialValuesRef.current = initialValues;
    setValues({
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      instructions: initialValues?.instructions ?? '',
    });
    seededFilesRef.current = files;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seeding is keyed on `initialValues` identity only, per this component's documented contract
  }, [initialValues]);

  const sortedFilesKey = (nodes: SkillFileTreeNode[]): string =>
    JSON.stringify([...nodes].sort((a, b) => a.path.localeCompare(b.path)));

  const isDirtyRef = useRef(false);
  useEffect(() => {
    if (isReseeding) return;
    const seededValues: SkillEditorValues = {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      instructions: initialValues?.instructions ?? '',
    };
    const isDirty =
      JSON.stringify(values) !== JSON.stringify(seededValues) ||
      sortedFilesKey(files) !== sortedFilesKey(seededFilesRef.current);
    if (isDirty !== isDirtyRef.current) {
      isDirtyRef.current = isDirty;
      onDirtyChange?.(isDirty);
    }
  }, [values, files, initialValues, isReseeding, onDirtyChange]);

  const [internalSelectedPath, setInternalSelectedPath] =
    useState(SKILL_MANIFEST_PATH);
  const selectedPath = controlledSelectedPath ?? internalSelectedPath;
  const handleSelectedPathChange = useCallback(
    (path: string) => {
      setInternalSelectedPath(path);
      onSelectedPathChange?.(path);
    },
    [onSelectedPathChange],
  );

  const [internalExpandedPaths, setInternalExpandedPaths] = useState<string[]>(
    [],
  );
  const expandedPaths = controlledExpandedPaths ?? internalExpandedPaths;
  const expandedPathsSet = useMemo(
    () => new Set(expandedPaths),
    [expandedPaths],
  );
  const handleExpandedPathsChange = useCallback(
    (next: Set<string>) => {
      const nextArray = [...next];
      setInternalExpandedPaths(nextArray);
      onExpandedPathsChange?.(nextArray);
    },
    [onExpandedPathsChange],
  );

  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>();
  /*
   * Collapsed on first paint. The accordion only mounts under the mobile
   * breakpoint — desktop renders the always-visible Files sidebar instead — so
   * the initial state needs no breakpoint check, and starting expanded would
   * push the Instructions editor below the fold on the narrowest layout.
   */
  const [isFilesExpanded, setIsFilesExpanded] = useState(false);

  /*
   * Files dropped anywhere on the editor surface (not just inside the
   * already-open dialog's own drop zone) open the upload dialog and stage
   * them immediately — dragging in from the OS shouldn't first require
   * clicking "Upload from device".
   */
  const handleSurfaceFilesDropped = useCallback(
    (droppedFileList: File[]) => {
      if (isUploadDialogOpen) return;
      setDroppedFiles(droppedFileList);
      setIsUploadDialogOpen(true);
    },
    [isUploadDialogOpen],
  );
  const {
    isDragActive: isSurfaceDragActive,
    dropZoneHandlers: surfaceDropZoneHandlers,
  } = useSkillFileDropZone(handleSurfaceFilesDropped);

  const t = labels ?? {};
  const colors = stylesProp?.colors;
  const typography = stylesProp?.typography ?? {};
  const titleClassName = typography.titleClassName ?? 'dial-body-semi-text';
  const helperTextClassName =
    typography.helperTextClassName ?? 'dial-tiny-semi-text';
  const removeIconClassName =
    typography.removeIconClassName ?? 'text-secondary';

  const cssVars = buildCssVars({
    '--se-title-color': colors?.title,
    '--se-helper-text-color': colors?.helperText,
  });

  const layoutStyles = colors?.border
    ? {
        colors: {
          headerBorderColor: colors.border,
          sidebarBorderColor: colors.border,
        },
      }
    : undefined;

  const treeItems: DialFile[] = useMemo(
    () =>
      buildDialFileTree([
        {
          path: SKILL_MANIFEST_PATH,
          name: SKILL_MANIFEST_PATH,
          kind: SkillFileNodeKind.File,
        },
        ...files,
      ]),
    [files],
  );

  const selectedNode = useMemo(
    () => files.find((node) => node.path === selectedPath),
    [files, selectedPath],
  );

  const handleTreeItemClick = useCallback(
    (item: DialFile) => {
      handleSelectedPathChange(item.path);
    },
    [handleSelectedPathChange],
  );

  const handleRemoveNode = useCallback(
    (path: string) => {
      fileActions.onRemoveNode(path);
      if (selectedPath === path) {
        handleSelectedPathChange(SKILL_MANIFEST_PATH);
      }
    },
    [fileActions, selectedPath, handleSelectedPathChange],
  );

  const getContextMenuItems = useCallback(
    (item: DialFile): DropdownItem[] => {
      if (item.path === SKILL_MANIFEST_PATH) return [];
      return [
        {
          key: 'remove',
          label: t.removeLabel ?? 'Remove',
          icon: (
            <IconTrashX
              size={DIAL_ICON_SIZE.SM}
              className={removeIconClassName}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          ),
          onClick: () => handleRemoveNode(item.path),
        },
      ];
    },
    [t.removeLabel, removeIconClassName, handleRemoveNode],
  );

  const filesPane = (
    <div className="flex flex-col gap-2 desktop:gap-5">
      <div className="flex items-center justify-between">
        <span className={mergeClasses(styles.title, titleClassName)}>
          {t.filesHeading ?? 'Files'}
        </span>
        <NeutralButton
          label={t.addUploadLabel ?? 'Upload from device'}
          iconBefore={
            <IconPlus size={16} aria-hidden stroke={DIAL_KIT_ICON_STROKE} />
          }
          onClick={() => {
            setDroppedFiles(undefined);
            setIsUploadDialogOpen(true);
          }}
        />
      </div>
      <div role="tree" aria-label={t.filesTreeAriaLabel ?? 'Skill files'}>
        <DialFoldersTree
          items={treeItems}
          showFiles
          selectedPath={selectedPath}
          expandedPaths={expandedPathsSet}
          onExpandedPathsChange={handleExpandedPathsChange}
          onItemClick={handleTreeItemClick}
          getContextMenuItems={getContextMenuItems}
          rootItemPath=""
        />
      </div>
    </div>
  );

  const actions = (
    <>
      <NeutralButton
        label={t.cancelLabel ?? 'Cancel'}
        onClick={onCancel}
        disabled={isSubmitting}
      />
      <PrimaryButton
        label={t.createLabel ?? 'Create'}
        iconBefore={
          isSubmitting ? <Spinner size={16} ariaLabel="" /> : undefined
        }
        onClick={() => onSubmit(values)}
        disabled={isSubmitting}
      />
    </>
  );

  if (isLoading) {
    return (
      <div dir={dir} className="relative flex min-h-0 flex-1 flex-col">
        <EditorLayout
          title={title}
          onBack={onBack}
          backAriaLabel={backAriaLabel}
          actions={actions}
          isSaving={false}
          labels={{ savingStatusLabel: t.savingStatusLabel }}
          styles={layoutStyles}
          leftContent={
            <div
              role="status"
              aria-label={t.loadingAriaLabel ?? 'Loading skill'}
              className="flex flex-1 items-center justify-center p-8"
            >
              <Spinner />
            </div>
          }
        />
      </div>
    );
  }

  if (hasLoadError) {
    return (
      <div dir={dir} className="relative flex min-h-0 flex-1 flex-col">
        <EditorLayout
          title={title}
          onBack={onBack}
          backAriaLabel={backAriaLabel}
          actions={actions}
          isSaving={false}
          labels={{ savingStatusLabel: t.savingStatusLabel }}
          styles={layoutStyles}
          leftContent={
            <div role="alert" className="flex flex-col items-center gap-4 p-8">
              <ErrorText
                text={
                  t.loadErrorMessage ??
                  "Couldn't load this skill. Please try again."
                }
              />
              <PrimaryButton
                label={t.retryLabel ?? 'Retry'}
                onClick={onRetry}
              />
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div
      dir={dir}
      className="relative flex min-h-0 flex-1 flex-col"
      style={cssVars}
      {...surfaceDropZoneHandlers}
    >
      <SkillFileDropOverlay
        isVisible={isSurfaceDragActive && !isUploadDialogOpen}
        labels={labels}
      />

      <EditorLayout
        title={title}
        onBack={onBack}
        backAriaLabel={backAriaLabel}
        actions={actions}
        isSaving={isSubmitting}
        labels={{ savingStatusLabel: t.savingStatusLabel }}
        styles={layoutStyles}
        leftContent={
          <>
            {/* Mobile: collapsible file-list summary, collapsed by default. */}
            <div className="px-4 py-4 desktop:hidden">
              <Accordion
                title={t.editingFileLabel ?? 'Editing file'}
                description={selectedNode?.name ?? SKILL_MANIFEST_PATH}
                expanded={isFilesExpanded}
                onToggle={setIsFilesExpanded}
                ariaLabel={t.editingFileLabel ?? 'Editing file'}
              >
                {filesPane}
              </Accordion>
            </div>

            {/* Desktop: always-visible Files panel. */}
            <div className="hidden px-8 py-6 desktop:block">{filesPane}</div>
          </>
        }
        rightContent={
          <div className="flex flex-1 flex-col gap-4 px-4 py-6 desktop:gap-5 desktop:px-8">
            {submitError != null && (
              <div role="alert">
                <ErrorText text={submitError} />
              </div>
            )}
            {conflict != null && (
              <div role="alert" className="flex items-center gap-2">
                <ErrorText text={conflict.message} />
                <GhostButton
                  label={t.reloadLatestLabel ?? 'Reload latest'}
                  onClick={onReloadLatest}
                />
              </div>
            )}

            <h2 className={mergeClasses(styles.title, titleClassName)}>
              {selectedPath === SKILL_MANIFEST_PATH
                ? SKILL_MANIFEST_PATH
                : (t.selectedFileHeading?.(
                    selectedNode?.name ?? selectedPath,
                  ) ??
                  selectedNode?.name ??
                  selectedPath)}
            </h2>

            {selectedPath === SKILL_MANIFEST_PATH ? (
              <>
                <Input
                  labelProps={{
                    label: t.nameLabel ?? 'Name',
                    required: true,
                  }}
                  value={values.name}
                  onChange={(value) =>
                    setValues((prev) => ({ ...prev, name: value ?? '' }))
                  }
                  placeholder={t.namePlaceholder ?? 'good-morning-breakfast'}
                  caption={
                    errors?.name
                      ? undefined
                      : (t.nameCaption ??
                        "Lowercase letters and hyphens only, no spaces. We'll reformat automatically if needed.")
                  }
                  error={errors?.name}
                  invalid={!!errors?.name}
                  disabled={isNameReadOnly}
                />
                <Textarea
                  labelProps={{
                    label: t.descriptionLabel ?? 'Description',
                    required: true,
                  }}
                  value={values.description}
                  placeholder={
                    t.descriptionPlaceholder ??
                    'What this skill does and when to use it'
                  }
                  onChange={(value) =>
                    setValues((prev) => ({ ...prev, description: value }))
                  }
                  error={errors?.description}
                  invalid={!!errors?.description}
                />
                <div className="flex flex-1 flex-col gap-2">
                  <span className="flex items-center gap-0.5">
                    <span
                      className={mergeClasses(
                        styles.helperText,
                        helperTextClassName,
                      )}
                    >
                      {t.instructionsLabel ?? 'Instructions'}
                    </span>
                    <span className="dial-tiny-text text-error">*</span>
                  </span>
                  <Suspense
                    fallback={
                      <Spinner
                        ariaLabel={t.instructionsLoadingAriaLabel ?? 'Loading'}
                      />
                    }
                  >
                    <LazyMarkdown
                      value={values.instructions}
                      onChange={(value) =>
                        setValues((prev) => ({
                          ...prev,
                          instructions: value,
                        }))
                      }
                      theme={instructionsEditorTheme}
                      placeholder={
                        t.instructionsPlaceholder ??
                        'Write the skill instructions in Markdown'
                      }
                    />
                  </Suspense>
                  {errors?.instructions != null && (
                    <ErrorText text={errors.instructions} />
                  )}
                </div>
              </>
            ) : (
              selectedNode?.kind === SkillFileNodeKind.File &&
              (supportingFileContent ?? (
                <CaptionText
                  text={
                    t.supportingFileNote ??
                    'This supporting file is included in the skill package as-is. Remove it from the Files panel to replace its content.'
                  }
                />
              ))
            )}
          </div>
        }
      />

      <SkillFileUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => {
          setIsUploadDialogOpen(false);
          setDroppedFiles(undefined);
        }}
        fileActions={fileActions}
        initialFiles={droppedFiles}
        labels={labels}
      />
    </div>
  );
};
