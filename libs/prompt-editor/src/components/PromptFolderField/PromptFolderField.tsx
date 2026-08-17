import { mergeClasses } from '@epam/ai-dial-chat-shared';
import {
  DIAL_ICON_SIZE,
  ElementSize,
  GhostIconButton,
  Input,
  NeutralButton,
  Select,
} from '@epam/ai-dial-ui-kit';
import { IconFolderPlus, IconPencil, IconTrashX } from '@tabler/icons-react';
import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { PromptFolderFieldProps } from '../../models/prompt-folder-field-props';
import { FolderFormMode } from '../../types/folder-form-mode';

/** Root folder is modelled as the empty string, matching the prompts contract. */
const ROOT_FOLDER_ID = '';

/*
 * `Select` cannot represent the root folder with an empty-string value — an
 * empty value reads as "nothing selected" — so the root option carries this
 * sentinel and is translated back at the boundary.
 */
const ROOT_OPTION_VALUE = '__root__';

const lastSegment = (folderId: string): string =>
  folderId.split('/').pop() ?? '';

/** Folder picker with inline create, rename, and delete controls. */
export const PromptFolderField: FC<PromptFolderFieldProps> = ({
  value,
  folders,
  error,
  nameError,
  actions,
  disabled = false,
  labels,
  helperTextClassName = 'dial-small-text',
  onChange,
}) => {
  const [mode, setMode] = useState<FolderFormMode | null>(null);
  const [folderName, setFolderName] = useState('');
  const [validationError, setValidationError] = useState<string>();
  const [isPending, setIsPending] = useState(false);

  const isRootSelected = value === ROOT_FOLDER_ID;
  const rootOptionLabel = labels?.folderRootOption ?? 'Root';
  const emptyStateLabel = labels?.folderEmptyState ?? 'No folders yet';

  const options = useMemo(
    () => [
      { value: ROOT_OPTION_VALUE, label: rootOptionLabel },
      ...folders.map((folder) => ({ value: folder.id, label: folder.id })),
    ],
    [folders, rootOptionLabel],
  );

  const closeForm = useCallback(() => {
    setMode(null);
    setFolderName('');
    setValidationError(undefined);
  }, []);

  const handleSubmitName = useCallback(async () => {
    if (isPending || actions == null) return;

    const trimmed = folderName.trim();
    const message = actions.onValidateFolderName?.(trimmed);
    if (message != null) {
      setValidationError(message);
      return;
    }
    setValidationError(undefined);
    setIsPending(true);
    try {
      if (mode === FolderFormMode.Create) {
        const created = await actions.onCreateFolder(
          trimmed,
          isRootSelected ? undefined : value,
        );
        if (typeof created === 'string') onChange(created);
      } else {
        const renamed = await actions.onRenameFolder(value, trimmed);
        if (typeof renamed === 'string') onChange(renamed);
      }
      closeForm();
    } catch {
      /*
       * The host reports the failure through `nameError` (a conflict) or its
       * own notification surface; the sub-form stays open with the entered
       * name so it can be corrected.
       */
    } finally {
      setIsPending(false);
    }
  }, [
    isPending,
    actions,
    folderName,
    mode,
    isRootSelected,
    value,
    onChange,
    closeForm,
  ]);

  const handleConfirmDelete = useCallback(async () => {
    if (isPending || actions == null) return;
    setIsPending(true);
    try {
      await actions.onDeleteFolder(value);
      /*
       * The selected folder no longer exists, so fall back to root before the
       * next save targets a path that is gone.
       */
      onChange(ROOT_FOLDER_ID);
      closeForm();
    } catch {
      /* Reported by the host; leave the confirmation open. */
    } finally {
      setIsPending(false);
    }
  }, [isPending, actions, value, onChange, closeForm]);

  const openCreate = useCallback(() => {
    setFolderName('');
    setValidationError(undefined);
    setMode(FolderFormMode.Create);
  }, []);

  const openRename = useCallback(() => {
    setFolderName(lastSegment(value));
    setValidationError(undefined);
    setMode(FolderFormMode.Rename);
  }, [value]);

  const openDelete = useCallback(() => {
    setValidationError(undefined);
    setMode(FolderFormMode.ConfirmDelete);
  }, []);

  const handleSelect = useCallback(
    (next: string | string[] | null) => {
      const selected = Array.isArray(next) ? next[0] : next;
      if (selected == null) return;
      onChange(selected === ROOT_OPTION_VALUE ? ROOT_FOLDER_ID : selected);
    },
    [onChange],
  );

  const isNameFormOpen =
    mode === FolderFormMode.Create || mode === FolderFormMode.Rename;
  const nameFieldError = validationError ?? nameError;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <Select
          id="prompt-folder"
          className="flex-1"
          options={options}
          value={isRootSelected ? ROOT_OPTION_VALUE : value}
          labelProps={{ label: labels?.folderLabel ?? 'Folder' }}
          invalid={error != null}
          disabled={disabled}
          error={error}
          emptyStateTitle={emptyStateLabel}
          onChange={handleSelect}
        />
        {actions != null && !disabled && (
          <>
            <GhostIconButton
              icon={<IconFolderPlus size={DIAL_ICON_SIZE.SM} aria-hidden />}
              aria-label={labels?.folderCreateLabel ?? 'Create folder'}
              onClick={openCreate}
            />
            <GhostIconButton
              icon={<IconPencil size={DIAL_ICON_SIZE.SM} aria-hidden />}
              aria-label={labels?.folderRenameLabel ?? 'Rename folder'}
              disabled={isRootSelected}
              onClick={openRename}
            />
            <GhostIconButton
              icon={<IconTrashX size={DIAL_ICON_SIZE.SM} aria-hidden />}
              aria-label={labels?.folderDeleteLabel ?? 'Delete folder'}
              disabled={isRootSelected}
              onClick={openDelete}
            />
          </>
        )}
      </div>

      {folders.length === 0 && mode == null && (
        <p className={mergeClasses('m-0', helperTextClassName)}>
          {emptyStateLabel}
        </p>
      )}

      {/*
       * The sub-form repeats the outer form's Save/Cancel labels, so it is a
       * named region — otherwise both pairs are indistinguishable to a screen
       * reader walking the page's controls.
       */}
      {isNameFormOpen && (
        <div
          role="group"
          aria-label={
            mode === FolderFormMode.Create
              ? (labels?.folderCreateLabel ?? 'Create folder')
              : (labels?.folderRenameLabel ?? 'Rename folder')
          }
          className="flex items-end gap-2"
        >
          <Input
            id="prompt-folder-name"
            className="flex-1"
            value={folderName}
            autoFocus
            labelProps={{
              label: labels?.folderNameLabel ?? 'Folder name',
              required: true,
            }}
            invalid={nameFieldError != null}
            error={nameFieldError}
            onChange={(next) => setFolderName(next ?? '')}
          />
          <NeutralButton
            size={ElementSize.Standard}
            label={labels?.saveLabel ?? 'Save'}
            disabled={isPending}
            onClick={handleSubmitName}
          />
          <NeutralButton
            size={ElementSize.Standard}
            label={labels?.cancelLabel ?? 'Cancel'}
            disabled={isPending}
            onClick={closeForm}
          />
        </div>
      )}

      {mode === FolderFormMode.ConfirmDelete && (
        <div
          role="alertdialog"
          aria-label={labels?.folderDeleteConfirmTitle ?? 'Delete folder'}
        >
          <p className={mergeClasses('m-0 mb-2', helperTextClassName)}>
            {labels?.folderDeleteConfirmMessage?.(value) ??
              `Delete "${value}" and every prompt inside it?`}
          </p>
          <div className="flex gap-2">
            <NeutralButton
              size={ElementSize.Standard}
              label={labels?.folderDeleteLabel ?? 'Delete folder'}
              autoFocus
              disabled={isPending}
              onClick={handleConfirmDelete}
            />
            <NeutralButton
              size={ElementSize.Standard}
              label={labels?.cancelLabel ?? 'Cancel'}
              disabled={isPending}
              onClick={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  );
};
