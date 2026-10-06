import {
  DEFAULT_METADATA_FORM_LABELS,
  EntityEditor,
  MetadataField,
  MetadataForm,
  type DeploymentCreationFormValues,
  type EntityEditorProps,
  type MetadataFormLabels,
} from '@epam/ai-dial-builder-form';
import {
  buildCssVars,
  MARKDOWN_EDITOR_FILL_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
  MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
  mergeClasses,
  useAvailableHeightCap,
  TextRefinementField,
  useTextRefinement,
  type TextRefinementCallback,
} from '@epam/ai-dial-chat-shared';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import {
  DialFileNodeType,
  DialFoldersTree,
} from '@epam/ai-dial-react-file-manager';
import {
  Accordion,
  ButtonAppearance,
  ButtonDropdown,
  ButtonVariant,
  CaptionText,
  DIAL_ICON_SIZE,
  DIAL_KIT_ICON_STROKE,
  EditorThemes,
  ElementSize,
  ErrorText,
  GhostButton,
  Label,
  PrimaryButton,
  Spinner,
  type DropdownItem,
} from '@epam/ai-dial-ui-kit';
import { LazyMarkdownEditor } from '@epam/ai-dial-ui-kit/editors';
import {
  IconDatabase,
  IconFileZip,
  IconFolderPlus,
  IconPlus,
  IconTrashX,
  IconUpload,
  type TablerIcon,
} from '@tabler/icons-react';
/*
 * Only needed once `LazyMarkdownEditor` actually renders (below). Importing
 * it here, rather than eagerly from the host app's entry point, keeps this
 * vendor CSS out of the initial page load — it loads only when this module
 * does, i.e. when the (already route-lazy) skill editor page mounts.
 */
import '@uiw/react-markdown-preview/markdown.css';
import '@uiw/react-md-editor/markdown-editor.css';
import {
  ComponentType,
  FC,
  ReactNode,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SKILL_EDITOR_CLASS } from '../../constants/public-class-names';
import { useDraftFolder } from '../../hooks/useDraftFolder';
import { useSkillFileDropZone } from '../../hooks/useSkillFileDropZone';
import type {
  SkillEditorProps,
  SkillEditorValues,
  SkillFileSourceEntry,
  SkillFileTreeNode,
} from '../../models/skill-editor-props';
import { SkillAddSource } from '../../types/skill-add-source';
import { SKILL_MANIFEST_PATH } from '../../types/skill-editor-defaults';
import { SkillFileNodeKind } from '../../types/skill-file-node-kind';
import { SkillFileUploadMode } from '../../types/skill-file-upload-mode';
import { SkillFilesPane } from '../../types/skill-files-pane';
import { buildDialFileTree, resolveAddTarget } from '../../utils/file-tree';
import { renderIcon } from '../../utils/icon';
import { SkillFileDropOverlay } from '../SkillFileDropOverlay/SkillFileDropOverlay';
import { SkillFileUploadDialog } from '../SkillFileUploadDialog/SkillFileUploadDialog';
import styles from './SkillEditor.module.scss';

/** What the upload dialog was last opened for. */
interface UploadRequest {
  mode: SkillFileUploadMode;
  targetFolderPath: string;
  initialFiles?: File[];
  initialEntries?: SkillFileSourceEntry[];
}

const DEFAULT_UPLOAD_REQUEST: UploadRequest = {
  mode: SkillFileUploadMode.Files,
  targetFolderPath: '',
};

type MarkdownEditorComponent = ComponentType<{
  value: string;
  onChange: (value: string) => void;
  height?: number;
  className?: string;
  placeholder?: string;
  theme?: EditorThemes;
  id?: string;
  ariaLabel?: string;
}>;

const METADATA_FIELDS = [MetadataField.Name, MetadataField.Description];

/* Instructions fill the column to the bottom, ending on the column's `py-6`. */
const INSTRUCTIONS_EDITOR_BOTTOM_GAP = 24;
/* Filling never shrinks the editor below a usable height. */
const INSTRUCTIONS_EDITOR_MIN_HEIGHT = 300;

/* Paddings of the Files column and the selected-file column, as before the shared editor. */
const FILES_SECTION_CLASS_NAME = 'desktop:px-8 desktop:py-6';
const SETUP_SECTION_CLASS_NAME =
  'gap-4 px-4 py-6 desktop:gap-5 desktop:px-8 desktop:py-6';

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
  onValuesChange,
  onRefineDescription,
  onRefineInstructions,
  fileActions,
  supportingFileContent,
  onSubmit,
  onCancel,
  onBack,
  backAriaLabel,
  title,
  onRetry,
  onRetrySubmit,
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
  const instructionsId = useId();
  const refinementLock = useRef<AbortSignal | undefined>(undefined);
  const instructionsCapRef = useAvailableHeightCap<HTMLDivElement>({
    bottomGap: INSTRUCTIONS_EDITOR_BOTTOM_GAP,
    minHeight: INSTRUCTIONS_EDITOR_MIN_HEIGHT,
  });
  const valuesRef = useRef(values);
  const updateValues = (patch: Partial<SkillEditorValues>) => {
    const next = { ...valuesRef.current, ...patch };
    valuesRef.current = next;
    setValues(next);
    onValuesChange?.(next);
  };
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
    onChange: (description) => updateValues({ description }),
    onRefine: guardRefinement(onRefineDescription),
    disabled: isSubmitting || isLoading || hasLoadError,
    resetKey: initialValues,
  });
  const instructionsRefinement = useTextRefinement({
    value: values.instructions,
    onChange: (instructions) => updateValues({ instructions }),
    onRefine: guardRefinement(onRefineInstructions),
    disabled: isSubmitting || isLoading || hasLoadError,
    resetKey: initialValues,
  });
  const isRefining =
    descriptionRefinement.isPending || instructionsRefinement.isPending;
  const resetRefinement = () => {
    descriptionRefinement.reset();
    instructionsRefinement.reset();
  };
  const handleCancel = () => {
    resetRefinement();
    onCancel();
  };
  const handleBack = () => {
    resetRefinement();
    onBack();
  };
  const handleSubmit = () => {
    if (
      isSubmitting ||
      isLoading ||
      hasLoadError ||
      (refinementLock.current && !refinementLock.current.aborted)
    )
      return;
    onSubmit(values);
  };
  const seededInitialValuesRef = useRef(initialValues);
  const isReseeding = seededInitialValuesRef.current !== initialValues;
  const seededFilesRef = useRef<SkillFileTreeNode[]>(files);
  useEffect(() => {
    seededInitialValuesRef.current = initialValues;
    const seeded = {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      instructions: initialValues?.instructions ?? '',
    };
    valuesRef.current = seeded;
    setValues(seeded);
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
  const [uploadRequest, setUploadRequest] = useState<UploadRequest>(
    DEFAULT_UPLOAD_REQUEST,
  );
  const openUploadDialog = useCallback((request: UploadRequest) => {
    setUploadRequest(request);
    setIsUploadDialogOpen(true);
  }, []);
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
      openUploadDialog({
        ...DEFAULT_UPLOAD_REQUEST,
        initialFiles: droppedFileList,
      });
    },
    [isUploadDialogOpen, openUploadDialog],
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
  const removeIconClassName = typography.removeIconClassName;
  const menuIconClassName = typography.menuIconClassName ?? 'text-secondary';

  const cssVars = buildCssVars({
    '--se-title-color': colors?.title,
    '--se-helper-text-color': colors?.helperText,
    '--se-refine-action-text': colors?.refineActionText,
    '--se-refine-error-text': colors?.refineErrorText,
  });

  const refinementStyles = {
    feedbackClassName: mergeClasses(
      // Unset overrides keep the kit CaptionText input-caption styling.
      colors?.refineActionText && styles.refineFeedback,
      typography.refineFeedbackClassName,
      SKILL_EDITOR_CLASS.refineFeedback,
    ),
    errorClassName: styles.refineError,
  };
  const editorStyles: EntityEditorProps['styles'] = {
    layout: colors?.border
      ? {
          colors: {
            headerBorderColor: colors.border,
            sidebarBorderColor: colors.border,
          },
        }
      : undefined,
    section: colors?.title
      ? { colors: { titleColor: colors.title } }
      : undefined,
  };

  const folderNameMessages = useMemo(
    () => ({
      required: t.folderNameRequiredError ?? 'Enter a folder name',
      invalid:
        t.folderNameInvalidError ??
        "Folder name can't contain / or \\, or be . or ..",
      duplicate:
        t.folderNameDuplicateError ??
        'An item with this name already exists here',
    }),
    [
      t.folderNameRequiredError,
      t.folderNameInvalidError,
      t.folderNameDuplicateError,
    ],
  );
  const revealFolder = useCallback(
    (path: string) => {
      if (expandedPathsSet.has(path)) return;
      handleExpandedPathsChange(new Set([...expandedPathsSet, path]));
    },
    [expandedPathsSet, handleExpandedPathsChange],
  );
  const draftFolder = useDraftFolder({
    files,
    fileActions,
    defaultName: t.newFolderDefaultName ?? 'New folder',
    messages: folderNameMessages,
    onRevealFolder: revealFolder,
    onCreated: handleSelectedPathChange,
  });
  const { draftNode, draftPath, draftPane } = draftFolder;

  /*
   * The Files pane renders once per breakpoint, so the draft (and its inline
   * rename field) lives only in the rendering the user started it from —
   * two live rename fields would both save on the same outside click.
   */
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
  const treeItemsWithDraft: DialFile[] = useMemo(
    () =>
      draftNode
        ? buildDialFileTree([
            {
              path: SKILL_MANIFEST_PATH,
              name: SKILL_MANIFEST_PATH,
              kind: SkillFileNodeKind.File,
            },
            ...files,
            draftNode,
          ])
        : treeItems,
    [files, draftNode, treeItems],
  );

  const selectedNode = useMemo(
    () => files.find((node) => node.path === selectedPath),
    [files, selectedPath],
  );

  const handleTreeItemClick = useCallback(
    (item: DialFile) => {
      if (item.path === draftPath) return;
      handleSelectedPathChange(item.path);
    },
    [handleSelectedPathChange, draftPath],
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

  const { startDraft } = draftFolder;
  const { onCreateFolder, extractArchive, pickFromFileSystem } = fileActions;

  const handlePickFromFileSystem = useCallback(
    async (targetFolderPath: string) => {
      if (!pickFromFileSystem) return;
      const entries = await pickFromFileSystem();
      if (!entries?.length) return;
      openUploadDialog({
        mode: SkillFileUploadMode.Files,
        targetFolderPath,
        initialEntries: entries,
      });
    },
    [pickFromFileSystem, openUploadDialog],
  );

  const buildAddMenuItems = useCallback(
    (targetFolderPath: string, pane: SkillFilesPane): DropdownItem[] => {
      const menuIcon = (Icon: TablerIcon) =>
        renderIcon(Icon, menuIconClassName);
      const items: DropdownItem[] = [];
      if (onCreateFolder) {
        items.push({
          key: 'create-folder',
          label: t.createFolderLabel ?? 'Create folder',
          icon: menuIcon(IconFolderPlus),
          onClick: () => startDraft(targetFolderPath, pane),
        });
      }
      items.push({
        key: 'upload-files',
        label: t.uploadFilesLabel ?? 'Upload files from device',
        icon: menuIcon(IconUpload),
        onClick: () =>
          openUploadDialog({
            mode: SkillFileUploadMode.Files,
            targetFolderPath,
          }),
      });
      if (extractArchive) {
        items.push({
          key: 'upload-archive',
          label: t.uploadArchiveLabel ?? 'Upload archive from device',
          icon: menuIcon(IconFileZip),
          onClick: () =>
            openUploadDialog({
              mode: SkillFileUploadMode.Archive,
              targetFolderPath,
            }),
        });
      }
      if (pickFromFileSystem) {
        items.push({
          key: 'open-file-system',
          label: t.openFileSystemLabel ?? 'Open DIAL file system',
          icon: menuIcon(IconDatabase),
          onClick: () => void handlePickFromFileSystem(targetFolderPath),
        });
      }
      return items;
    },
    [
      menuIconClassName,
      onCreateFolder,
      extractArchive,
      pickFromFileSystem,
      t.createFolderLabel,
      t.uploadFilesLabel,
      t.uploadArchiveLabel,
      t.openFileSystemLabel,
      startDraft,
      openUploadDialog,
      handlePickFromFileSystem,
    ],
  );

  const headerAddItems = useMemo(() => {
    const target = resolveAddTarget(
      SkillAddSource.Header,
      files.find((node) => node.path === selectedPath),
    );
    return {
      [SkillFilesPane.Mobile]: buildAddMenuItems(target, SkillFilesPane.Mobile),
      [SkillFilesPane.Desktop]: buildAddMenuItems(
        target,
        SkillFilesPane.Desktop,
      ),
    };
  }, [buildAddMenuItems, files, selectedPath]);

  const buildContextMenuItems = useCallback(
    (item: DialFile, pane: SkillFilesPane): DropdownItem[] => {
      if (item.path === SKILL_MANIFEST_PATH || item.path === draftPath) {
        return [];
      }
      const node: SkillFileTreeNode = {
        path: item.path,
        name: item.name,
        kind:
          item.nodeType === DialFileNodeType.FOLDER
            ? SkillFileNodeKind.Folder
            : SkillFileNodeKind.File,
      };
      const items: DropdownItem[] = [];
      if (node.kind === SkillFileNodeKind.Folder) {
        items.push({
          key: 'add-child',
          icon: renderIcon(IconPlus),
          label: t.addChildLabel ?? 'Add child',
          children: buildAddMenuItems(
            resolveAddTarget(SkillAddSource.Child, node),
            pane,
          ),
        });
      }
      items.push(
        {
          key: 'add-sibling',
          icon: renderIcon(IconPlus),
          label: t.addSiblingLabel ?? 'Add sibling',
          children: buildAddMenuItems(
            resolveAddTarget(SkillAddSource.Sibling, node),
            pane,
          ),
        },
        {
          key: 'delete',
          label: t.deleteLabel ?? 'Delete',
          danger: true,
          icon: renderIcon(IconTrashX, removeIconClassName),
          onClick: () => handleRemoveNode(item.path),
        },
      );
      return items;
    },
    [
      draftPath,
      t.addChildLabel,
      t.addSiblingLabel,
      t.deleteLabel,
      removeIconClassName,
      buildAddMenuItems,
      handleRemoveNode,
    ],
  );
  const getContextMenuItems = useMemo(
    () => ({
      [SkillFilesPane.Mobile]: (item: DialFile) =>
        buildContextMenuItems(item, SkillFilesPane.Mobile),
      [SkillFilesPane.Desktop]: (item: DialFile) =>
        buildContextMenuItems(item, SkillFilesPane.Desktop),
    }),
    [buildContextMenuItems],
  );

  const renderFilesPane = (pane: SkillFilesPane) => (
    <div className="flex flex-col gap-2 desktop:gap-5">
      <div className="flex items-center justify-between">
        <span className={mergeClasses(styles.title, titleClassName)}>
          {t.filesHeading ?? 'Files'}
        </span>
        <ButtonDropdown
          label={t.addLabel ?? 'Add'}
          variant={ButtonVariant.Neutral}
          appearance={ButtonAppearance.Solid}
          size={ElementSize.Small}
          iconBefore={
            <IconPlus
              size={DIAL_ICON_SIZE.SM}
              aria-hidden
              stroke={DIAL_KIT_ICON_STROKE}
            />
          }
          items={headerAddItems[pane]}
        />
      </div>
      <div role="tree" aria-label={t.filesTreeAriaLabel ?? 'Skill files'}>
        <DialFoldersTree
          items={draftPane === pane ? treeItemsWithDraft : treeItems}
          showFiles
          selectedPath={selectedPath}
          expandedPaths={expandedPathsSet}
          onExpandedPathsChange={handleExpandedPathsChange}
          onItemClick={handleTreeItemClick}
          getContextMenuItems={getContextMenuItems[pane]}
          renamedPath={draftPane === pane ? draftPath : undefined}
          onRenameSave={draftFolder.handleSave}
          onRenameCancel={draftFolder.handleCancel}
          onRenameValidate={draftFolder.handleValidate}
          rootItemPath=""
        />
      </div>
    </div>
  );

  /* MetadataForm edits the shared deployment shape; the skill keeps only Name and Description. */
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
  const metadataErrors = useMemo(
    () => ({ name: errors?.name, description: errors?.description }),
    [errors?.name, errors?.description],
  );
  const metadataLabels = useMemo<MetadataFormLabels>(
    () => ({
      form: {
        ...DEFAULT_METADATA_FORM_LABELS,
        name: {
          label: t.nameLabel ?? 'Name',
          placeholder: t.namePlaceholder ?? 'good-morning-breakfast',
        },
        description: {
          label: t.descriptionLabel ?? 'Description',
          placeholder:
            t.descriptionPlaceholder ??
            'What this skill does and when to use it',
        },
        // The SKILL.md heading above the fields already names them.
        ariaLabel: undefined,
      },
    }),
    [
      t.nameLabel,
      t.namePlaceholder,
      t.descriptionLabel,
      t.descriptionPlaceholder,
    ],
  );
  const handleMetadataChange = (
    patch: Partial<DeploymentCreationFormValues>,
  ) => {
    if (patch.name !== undefined) updateValues({ name: patch.name });
    if (patch.description !== undefined) {
      descriptionRefinement.reset();
      updateValues({ description: patch.description });
    }
  };
  const renderRefinableDescription = onRefineDescription
    ? (textarea: ReactNode, fieldId: string) => (
        <TextRefinementField
          isEnabled
          fieldId={fieldId}
          required
          label={t.descriptionLabel ?? 'Description'}
          labels={t}
          refinement={descriptionRefinement}
          disabled={isRefining || isSubmitting}
          {...refinementStyles}
        >
          {textarea}
        </TextRefinementField>
      )
    : undefined;

  const editorProps = {
    title,
    onBack: handleBack,
    onCancel: handleCancel,
    onSubmit: handleSubmit,
    submitLabel: t.createLabel ?? 'Create',
    isSubmitDisabled: isRefining || isLoading || hasLoadError,
    labels: {
      cancelLabel: t.cancelLabel ?? 'Cancel',
      backAriaLabel: backAriaLabel ?? 'Back',
      savingStatusLabel: t.savingStatusLabel ?? 'Saving',
    },
    styles: editorStyles,
    metadataTitle: null,
  };

  if (isLoading) {
    return (
      <div dir={dir} className="relative flex min-h-0 flex-1 flex-col">
        <EntityEditor
          {...editorProps}
          metadata={
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
        <EntityEditor
          {...editorProps}
          metadata={
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

  const isManifestSelected = selectedPath === SKILL_MANIFEST_PATH;
  const setupTitle = isManifestSelected
    ? SKILL_MANIFEST_PATH
    : (t.selectedFileHeading?.(selectedNode?.name ?? selectedPath) ??
      selectedNode?.name ??
      selectedPath);

  const alert =
    submitError != null || conflict != null ? (
      <div className="flex flex-col gap-2">
        {submitError != null && (
          <div className="flex items-center gap-2">
            <ErrorText text={submitError} />
            {onRetrySubmit != null && (
              <GhostButton
                label={t.retryLabel ?? 'Retry'}
                onClick={onRetrySubmit}
              />
            )}
          </div>
        )}
        {conflict != null && (
          <div className="flex items-center gap-2">
            <ErrorText text={conflict.message} />
            <GhostButton
              label={t.reloadLatestLabel ?? 'Reload latest'}
              onClick={onReloadLatest}
            />
          </div>
        )}
      </div>
    ) : undefined;

  const instructionsEditor = (
    <TextRefinementField
      isEnabled={Boolean(onRefineInstructions)}
      fieldId={instructionsId}
      required
      labelClassName={mergeClasses(styles.helperText, helperTextClassName)}
      label={t.instructionsLabel ?? 'Instructions'}
      labels={t}
      refinement={instructionsRefinement}
      disabled={isRefining || isSubmitting}
      {...refinementStyles}
    >
      <div className="flex flex-1 flex-col gap-2">
        {!onRefineInstructions && (
          <Label
            htmlFor={instructionsId}
            className={mergeClasses(styles.helperText, helperTextClassName)}
            label={t.instructionsLabel ?? 'Instructions'}
            required
          />
        )}
        <div
          ref={instructionsCapRef}
          className={mergeClasses(
            MARKDOWN_EDITOR_MAX_HEIGHT_CLASS_NAME,
            MARKDOWN_EDITOR_FILL_HEIGHT_CLASS_NAME,
            MARKDOWN_EDITOR_PREVIEW_LIST_CLASS_NAME,
          )}
        >
          <Suspense
            fallback={
              <Spinner
                ariaLabel={t.instructionsLoadingAriaLabel ?? 'Loading'}
              />
            }
          >
            <LazyMarkdown
              id={instructionsId}
              ariaLabel={t.instructionsLabel ?? 'Instructions'}
              value={values.instructions}
              onChange={(value) => {
                instructionsRefinement.reset();
                updateValues({ instructions: value });
              }}
              theme={instructionsEditorTheme}
              placeholder={
                t.instructionsPlaceholder ??
                'Write the skill instructions in Markdown'
              }
            />
          </Suspense>
        </div>
        {errors?.instructions != null && (
          <ErrorText text={errors.instructions} />
        )}
      </div>
    </TextRefinementField>
  );

  return (
    <div
      dir={dir}
      className={mergeClasses(
        'relative flex min-h-0 flex-1 flex-col',
        SKILL_EDITOR_CLASS.root,
      )}
      style={cssVars}
      {...surfaceDropZoneHandlers}
    >
      <SkillFileDropOverlay
        isVisible={isSurfaceDragActive && !isUploadDialogOpen}
        labels={labels}
      />

      <EntityEditor
        {...editorProps}
        isSubmitting={isSubmitting}
        metadataSectionClassName={FILES_SECTION_CLASS_NAME}
        metadata={
          <>
            {/* Mobile: collapsible file-list summary, collapsed by default. */}
            <div className="desktop:hidden">
              <Accordion
                title={t.editingFileLabel ?? 'Editing file'}
                description={selectedNode?.name ?? SKILL_MANIFEST_PATH}
                expanded={isFilesExpanded}
                onToggle={setIsFilesExpanded}
                ariaLabel={t.editingFileLabel ?? 'Editing file'}
              >
                {renderFilesPane(SkillFilesPane.Mobile)}
              </Accordion>
            </div>

            {/* Desktop: always-visible Files panel. */}
            <div className="hidden desktop:block">
              {renderFilesPane(SkillFilesPane.Desktop)}
            </div>
          </>
        }
        alert={alert}
        setupTitle={setupTitle}
        setupSectionClassName={SETUP_SECTION_CLASS_NAME}
        setup={
          isManifestSelected ? (
            <>
              <MetadataForm
                values={metadataValues}
                errors={metadataErrors}
                onChange={handleMetadataChange}
                fields={METADATA_FIELDS}
                isDescriptionRequired
                isNameReadOnly={isNameReadOnly}
                nameCaption={
                  errors?.name
                    ? undefined
                    : (t.nameCaption ??
                      "Lowercase letters and hyphens only, no spaces. We'll reformat automatically if needed.")
                }
                renderDescription={renderRefinableDescription}
                labels={metadataLabels}
              />
              {instructionsEditor}
            </>
          ) : (
            <>
              {selectedNode?.kind === SkillFileNodeKind.File && (
                <div className="flex min-h-0 flex-1 flex-col">
                  {supportingFileContent ?? (
                    <CaptionText
                      text={
                        t.supportingFileNote ??
                        'This supporting file is included in the skill package as-is. Remove it from the Files panel to replace its content.'
                      }
                    />
                  )}
                </div>
              )}
            </>
          )
        }
      />

      <SkillFileUploadDialog
        isOpen={isUploadDialogOpen}
        onClose={() => setIsUploadDialogOpen(false)}
        fileActions={fileActions}
        mode={uploadRequest.mode}
        targetFolderPath={uploadRequest.targetFolderPath}
        initialFiles={uploadRequest.initialFiles}
        initialEntries={uploadRequest.initialEntries}
        labels={labels}
      />
    </div>
  );
};
