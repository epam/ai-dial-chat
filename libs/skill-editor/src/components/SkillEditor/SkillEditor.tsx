import type { DialFile } from '@epam/ai-dial-react-file-manager';
import { DialFoldersTree } from '@epam/ai-dial-react-file-manager';
import {
  Accordion,
  CaptionText,
  ConfirmationPopup,
  ConfirmationPopupVariant,
  Dropdown,
  type DropdownItem,
  type EditorThemes,
  ErrorText,
  GhostButton,
  Input,
  LazyMarkdownEditor,
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
} from '../../models/skill-editor-props';
import { SKILL_MANIFEST_PATH } from '../../types/skill-editor-defaults';
import { SkillFileNodeKind } from '../../types/skill-file-node-kind';
import { buildDialFileTree } from '../../utils/file-tree';

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

type PendingAdd = { parentPath: string | null; kind: SkillFileNodeKind };

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
  fileActions,
  onSubmit,
  onCancel,
  onRetry,
  labels,
  styles,
  dir,
  instructionsEditorTheme = 'light',
}) => {
  const [values, setValues] = useState<SkillEditorValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    instructions: initialValues?.instructions ?? '',
  });
  useEffect(() => {
    setValues({
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      instructions: initialValues?.instructions ?? '',
    });
  }, [initialValues]);

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

  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [pendingAddValue, setPendingAddValue] = useState('');
  const [pendingAddError, setPendingAddError] = useState<string | undefined>();
  const [pendingRemovePath, setPendingRemovePath] = useState<string | null>(
    null,
  );
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [isFilesExpanded, setIsFilesExpanded] = useState(true);

  const t = labels ?? {};
  const typography = styles?.typography ?? {};
  const titleClassName = typography.titleClassName ?? 'dial-h1-text';
  const helperTextClassName =
    typography.helperTextClassName ?? 'dial-small-text';

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
          label: t.removeLabel ?? 'Remove',
          danger: true,
          icon: <IconTrashX size={16} aria-hidden />,
          onClick: () => setPendingRemovePath(item.path),
        },
      ];
    },
    [t.removeLabel],
  );

  const startPendingAdd = (kind: SkillFileNodeKind) => {
    setPendingAdd({ parentPath: null, kind });
    setPendingAddValue('');
    setPendingAddError(undefined);
  };

  const confirmPendingAdd = () => {
    if (!pendingAdd) return;
    const path = pendingAddValue.trim();
    const validationError = fileActions.validatePath(path);
    if (validationError) {
      setPendingAddError(validationError);
      return;
    }
    fileActions.onAddNode(path, pendingAdd.kind);
    setPendingAdd(null);
    setPendingAddValue('');
    setPendingAddError(undefined);
  };

  const cancelPendingAdd = () => {
    setPendingAdd(null);
    setPendingAddValue('');
    setPendingAddError(undefined);
  };

  const handleUploadInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationError = fileActions.validatePath(file.name);
    if (validationError) {
      setPendingAddError(validationError);
      return;
    }
    await fileActions.onUploadFile(file, file.name);
  };

  const addMenuItems: DropdownItem[] = [
    {
      key: 'new-file',
      label: t.addFileLabel ?? 'New file',
      onClick: () => startPendingAdd(SkillFileNodeKind.File),
    },
    {
      key: 'new-folder',
      label: t.addFolderLabel ?? 'New folder',
      onClick: () => startPendingAdd(SkillFileNodeKind.Folder),
    },
    {
      key: 'upload',
      label: t.addUploadLabel ?? 'Upload from device',
      onClick: () => uploadInputRef.current?.click(),
    },
  ];

  const filesTreeId = useId();
  const savingStatusId = useId();

  const renderFilesPane = () => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={titleClassName}>{t.filesHeading ?? 'Files'}</span>
        <Dropdown items={addMenuItems}>
          <GhostButton
            label={t.addLabel ?? 'Add'}
            iconBefore={<IconPlus size={16} aria-hidden />}
            aria-controls={filesTreeId}
            aria-haspopup="menu"
          />
        </Dropdown>
      </div>
      <input
        ref={uploadInputRef}
        type="file"
        className="hidden"
        onChange={handleUploadInputChange}
      />
      {pendingAdd && (
        <div className="flex items-center gap-2">
          <Input
            labelProps={{ label: t.newPathLabel ?? 'Path' }}
            placeholder={t.newPathPlaceholder ?? 'path/to/file.md'}
            value={pendingAddValue}
            onChange={(value) => setPendingAddValue(value ?? '')}
            error={pendingAddError}
            invalid={!!pendingAddError}
          />
          <PrimaryButton
            label={t.addLabel ?? 'Add'}
            onClick={confirmPendingAdd}
          />
          <GhostButton
            label={t.cancelLabel ?? 'Cancel'}
            onClick={cancelPendingAdd}
          />
        </div>
      )}
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
    <div dir={dir} className="flex h-full flex-col">
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

      {/* Desktop: static Files sidebar + main pane, actions inline in this header row. */}
      <div className="hidden items-start justify-end gap-2 px-4 py-2 desktop:flex">
        {actions}
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-20 desktop:flex-row desktop:pb-4">
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
        <div className="hidden desktop:block desktop:w-[280px] desktop:shrink-0">
          {filesPaneContent}
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <h2 className={titleClassName}>
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
              <div className="flex flex-1 flex-col gap-1">
                <span className={helperTextClassName}>
                  {t.instructionsLabel ?? 'Instructions'}
                </span>
                <Suspense
                  fallback={
                    <Spinner ariaLabel={t.loadingAriaLabel ?? 'Loading'} />
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
            selectedNode?.kind !== SkillFileNodeKind.Folder && (
              <CaptionText
                text={
                  t.supportingFileNote ??
                  'This supporting file is included in the skill package as-is. Remove it from the Files panel to replace its content.'
                }
              />
            )
          )}
        </div>
      </div>

      {/* Mobile: sticky action bar, always reachable without scrolling. */}
      <div className="fixed inset-x-0 bottom-0 flex items-center gap-2 border-t p-3 desktop:hidden">
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
