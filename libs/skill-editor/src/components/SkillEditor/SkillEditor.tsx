import { buildCssVars, mergeClasses } from '@epam/ai-dial-chat-shared';
import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { DialFoldersTree } from '@epam/ai-dial-react-file-manager';
import {
  Accordion,
  CaptionText,
  ConfirmationPopup,
  ConfirmationPopupVariant,
  type DropdownItem,
  type EditorThemes,
  ErrorText,
  GhostButton,
  Input,
  LazyMarkdownEditor,
  NeutralButton,
  PrimaryButton,
  Spinner,
  Textarea,
} from '@epam/ai-dial-ui-kit';
import { IconPlus, IconTrashX } from '@tabler/icons-react';
import {
  ComponentType,
  FC,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  SkillEditorProps,
  SkillEditorValues,
  SkillFileTreeNode,
} from '../../models/skill-editor-props';
import { SKILL_MANIFEST_PATH } from '../../types/skill-editor-defaults';
import { SkillFileNodeKind } from '../../types/skill-file-node-kind';
import { buildDialFileTree } from '../../utils/file-tree';
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
  headerContent,
  supportingFileContent,
  onSubmit,
  onCancel,
  onRetry,
  labels,
  styles: stylesProp,
  dir,
  instructionsEditorTheme = 'light',
}) => {
  const [values, setValues] = useState<SkillEditorValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    instructions: initialValues?.instructions ?? '',
  });
  const seededFilesRef = useRef<SkillFileTreeNode[]>(files);
  useEffect(() => {
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
  }, [values, files, initialValues, onDirtyChange]);

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

  const [pendingRemovePath, setPendingRemovePath] = useState<string | null>(
    null,
  );
  const [uploadError, setUploadError] = useState<string | undefined>();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isFilesExpanded, setIsFilesExpanded] = useState(true);

  const t = labels ?? {};
  const colors = stylesProp?.colors;
  const typography = stylesProp?.typography ?? {};
  const titleClassName = typography.titleClassName ?? 'dial-body-semi-text';
  const helperTextClassName =
    typography.helperTextClassName ?? 'dial-tiny-semi-text';
  const cssVars = buildCssVars({
    '--se-title-color': colors?.title,
    '--se-helper-text-color': colors?.helperText,
    '--se-border-color': colors?.border,
  });

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

  const getContextMenuItems = useCallback(
    (item: DialFile): DropdownItem[] => {
      if (item.path === SKILL_MANIFEST_PATH) return [];
      return [
        {
          key: 'remove',
          label: (
            <span className="text-error">{t.removeLabel ?? 'Remove'}</span>
          ),
          danger: true,
          icon: <IconTrashX size={16} className="text-error" aria-hidden />,
          onClick: () => setPendingRemovePath(item.path),
        },
      ];
    },
    [t.removeLabel],
  );

  const handleUploadInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationError = fileActions.validatePath(file.name);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setUploadError(undefined);
    try {
      await fileActions.onUploadFile(file, file.name);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : String(err));
    }
  };

  const filesTreeId = useId();
  const savingStatusId = useId();

  const renderFilesPane = () => (
    <div className="flex flex-col gap-2 desktop:gap-5">
      <div className="flex items-center justify-between">
        <span className={mergeClasses(styles.title, titleClassName)}>
          {t.filesHeading ?? 'Files'}
        </span>
        <NeutralButton
          label={t.addUploadLabel ?? 'Upload from device'}
          iconBefore={<IconPlus size={16} aria-hidden />}
          onClick={() => uploadInputRef.current?.click()}
        />
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadInputChange}
      />
      {uploadError && <ErrorText text={uploadError} />}
      <div
        id={filesTreeId}
        role="tree"
        aria-label={t.filesTreeAriaLabel ?? 'Skill files'}
      >
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

  const filesPaneContent = renderFilesPane();

  const savingStatusText = isSubmitting
    ? (t.savingStatusLabel ?? 'Saving')
    : '';

  const actions = (
    <>
      <GhostButton
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
      <div className="flex h-full items-center justify-center">
        <Spinner ariaLabel={t.loadingAriaLabel ?? 'Loading skill'} />
      </div>
    );
  }

  if (hasLoadError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-4 p-8">
        <ErrorText
          text={
            t.loadErrorMessage ?? "Couldn't load this skill. Please try again."
          }
        />
        <PrimaryButton label={t.retryLabel ?? 'Retry'} onClick={onRetry} />
      </div>
    );
  }

  return (
    <div dir={dir} className="flex h-full flex-col" style={cssVars}>
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
        id={savingStatusId}
      >
        {savingStatusText}
      </span>
      {submitError && (
        <div role="alert" className="px-4 pt-2">
          <ErrorText text={submitError} />
        </div>
      )}
      {conflict && (
        <div role="alert" className="flex items-center gap-2 px-4 pt-2">
          <ErrorText text={conflict.message} />
          <GhostButton
            label={t.reloadLatestLabel ?? 'Reload latest'}
            onClick={onReloadLatest}
          />
        </div>
      )}

      {/* Desktop: static Files sidebar + main pane; host header content + actions share this row. */}
      <div
        className={mergeClasses(
          'hidden items-center justify-between gap-2 border-b px-4 py-2 desktop:flex desktop:px-8 desktop:pb-3 desktop:pt-3',
          styles.headerBorder,
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {headerContent}
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-20 desktop:flex-row desktop:gap-0 desktop:px-0 desktop:pb-0">
        {/* Mobile: collapsible "Editing file" summary, defaults expanded. */}
        <div className="desktop:hidden">
          <Accordion
            title={t.editingFileLabel ?? 'Editing file'}
            description={selectedNode?.name ?? SKILL_MANIFEST_PATH}
            expanded={isFilesExpanded}
            onToggle={setIsFilesExpanded}
            ariaLabel={t.editingFileLabel ?? 'Editing file'}
          >
            {filesPaneContent}
          </Accordion>
        </div>

        {/* Desktop: always-visible Files sidebar. */}
        <div
          className={mergeClasses(
            'hidden border-e desktop:block desktop:w-[360px] desktop:shrink-0 desktop:px-8 desktop:py-6',
            styles.sidebarBorder,
          )}
        >
          {filesPaneContent}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 desktop:gap-5 desktop:px-8 desktop:py-6">
          <h2 className={mergeClasses(styles.title, titleClassName)}>
            {selectedPath === SKILL_MANIFEST_PATH
              ? SKILL_MANIFEST_PATH
              : (t.selectedFileHeading?.(selectedNode?.name ?? selectedPath) ??
                selectedNode?.name ??
                selectedPath)}
          </h2>

          {selectedPath === SKILL_MANIFEST_PATH ? (
            <>
              <Input
                labelProps={{ label: t.nameLabel ?? 'Name', required: true }}
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
                      setValues((prev) => ({ ...prev, instructions: value }))
                    }
                    theme={instructionsEditorTheme as EditorThemes}
                    placeholder={
                      t.instructionsPlaceholder ??
                      'Write the skill instructions in Markdown'
                    }
                  />
                </Suspense>
                {errors?.instructions && (
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
      </div>

      {/* Mobile: sticky action bar, always reachable without scrolling. */}
      <div
        className={mergeClasses(
          'fixed inset-x-0 bottom-0 flex items-center gap-2 border-t p-3 desktop:hidden',
          styles.actionBarBorder,
        )}
      >
        {actions}
      </div>

      {pendingRemovePath && (
        <ConfirmationPopup
          header={t.removeConfirmTitle ?? 'Remove file'}
          description={
            t.removeConfirmMessage?.(pendingRemovePath) ??
            `Remove "${pendingRemovePath}"? This cannot be undone.`
          }
          confirmLabel={t.removeConfirmLabel ?? 'Remove'}
          cancelLabel={t.removeCancelLabel ?? 'Cancel'}
          variant={ConfirmationPopupVariant.Danger}
          onConfirm={() => {
            fileActions.onRemoveNode(pendingRemovePath);
            if (selectedPath === pendingRemovePath) {
              handleSelectedPathChange(SKILL_MANIFEST_PATH);
            }
            setPendingRemovePath(null);
          }}
          onCancel={() => setPendingRemovePath(null)}
        />
      )}
    </div>
  );
};
