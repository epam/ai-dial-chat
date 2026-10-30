import { DeleteConfirmationDialog } from '@epam/ai-dial-chat-shared';
import {
  ButtonAppearance,
  ButtonVariant,
  Input,
  Popup,
  PopupSize,
} from '@epam/ai-dial-ui-kit';
import {
  type FC,
  type KeyboardEvent,
  memo,
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ProjectConversationListItem } from '../../models/project-conversation-list-props';
import type { ProjectConversationsPanelProps } from '../../models/project-conversations-panel-props';
import { ProjectConversationList } from '../ProjectConversationList/ProjectConversationList';

const ProjectConversationsPanelComponent: FC<
  ProjectConversationsPanelProps
> = ({
  composer,
  items,
  isLoading = false,
  hasError = false,
  onRetry,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onOpen,
  onRename,
  onDelete,
  labels,
  listTypography,
}) => {
  const renameInputId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const [renameRow, setRenameRow] =
    useState<ProjectConversationListItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | undefined>();
  const [isRenaming, setIsRenaming] = useState(false);
  const [deleteRow, setDeleteRow] =
    useState<ProjectConversationListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /* The ⋮ trigger that opened a dialog gets focus back when it closes. */
  const triggerRef = useRef<HTMLElement | null>(null);
  const rememberTrigger = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }, []);
  const restoreTriggerFocus = useCallback(() => {
    const trigger = triggerRef.current;
    triggerRef.current = null;
    if (trigger?.isConnected) window.setTimeout(() => trigger.focus(), 0);
  }, []);
  /* A deleted row takes its trigger with it: focus moves to the row now at its place, the one before, or the list. */
  const focusRowAfterDelete = useCallback((index: number) => {
    triggerRef.current = null;
    window.setTimeout(() => {
      const list = listRef.current;
      if (!list) return;
      const rows = list.querySelectorAll<HTMLElement>('li > button');
      const target =
        rows[Math.min(index, rows.length - 1)] ??
        list.querySelector<HTMLElement>('h2, section');
      if (target && !target.matches('button')) target.tabIndex = -1;
      target?.focus();
    }, 0);
  }, []);

  const findItem = useCallback(
    (id: string) => items.find((item) => item.id === id) ?? null,
    [items],
  );

  const handleRenameRequest = useCallback(
    (id: string) => {
      rememberTrigger();
      const item = findItem(id);
      setRenameRow(item);
      setRenameValue(item?.title ?? '');
      setRenameError(undefined);
    },
    [findItem, rememberTrigger],
  );
  const handleDeleteRequest = useCallback(
    (id: string) => {
      rememberTrigger();
      setDeleteRow(findItem(id));
    },
    [findItem, rememberTrigger],
  );
  const handleRenameClose = useCallback(() => {
    if (isRenaming) return;
    setRenameRow(null);
    restoreTriggerFocus();
  }, [isRenaming, restoreTriggerFocus]);
  const handleDeleteClose = useCallback(() => {
    if (isDeleting) return;
    setDeleteRow(null);
    restoreTriggerFocus();
  }, [isDeleting, restoreTriggerFocus]);

  const handleRenameSave = useCallback(async () => {
    if (!renameRow || !onRename || isRenaming) return;
    const newTitle = renameValue.trim();
    if (!newTitle) {
      setRenameError(labels.renameEmptyError);
      return;
    }
    setIsRenaming(true);
    try {
      await onRename(renameRow.id, newTitle);
      setRenameRow(null);
      restoreTriggerFocus();
    } catch {
      /* The host reports the failure; the dialog stays open for another try. */
    } finally {
      setIsRenaming(false);
    }
  }, [
    isRenaming,
    labels.renameEmptyError,
    onRename,
    renameRow,
    renameValue,
    restoreTriggerFocus,
  ]);
  const handleRenameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
      event.preventDefault();
      void handleRenameSave();
    },
    [handleRenameSave],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteRow || !onDelete) return;
    const index = items.findIndex((item) => item.id === deleteRow.id);
    setIsDeleting(true);
    try {
      await onDelete(deleteRow.id);
      setDeleteRow(null);
      focusRowAfterDelete(Math.max(index, 0));
    } catch {
      /* The host reports the failure; the dialog stays open for another try. */
    } finally {
      setIsDeleting(false);
    }
  }, [deleteRow, focusRowAfterDelete, items, onDelete]);

  const renameButtons = useMemo(
    () => [
      {
        label: labels.renameCancelLabel ?? 'Cancel',
        variant: ButtonVariant.Primary,
        appearance: ButtonAppearance.Ghost,
        disabled: isRenaming,
        onClick: handleRenameClose,
      },
      {
        label: labels.renameSaveLabel,
        variant: ButtonVariant.Primary,
        disabled: isRenaming,
        onClick: () => {
          void handleRenameSave();
        },
      },
    ],
    [
      handleRenameClose,
      handleRenameSave,
      isRenaming,
      labels.renameCancelLabel,
      labels.renameSaveLabel,
    ],
  );

  return (
    <>
      {composer}
      <div ref={listRef} className="contents">
        <ProjectConversationList
          items={items}
          isLoading={isLoading}
          hasError={hasError}
          onRetry={onRetry}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={onLoadMore}
          onOpen={onOpen}
          onRename={onRename ? handleRenameRequest : undefined}
          onDelete={onDelete ? handleDeleteRequest : undefined}
          labels={labels.list}
          typography={listTypography}
        />
      </div>
      {renameRow && (
        <Popup
          open
          header={labels.renameTitle}
          size={PopupSize.Sm}
          mainButtons={renameButtons}
          onClose={handleRenameClose}
        >
          <div className="px-6 py-4">
            <Input
              id={renameInputId}
              value={renameValue}
              labelProps={{ label: labels.renameInputLabel }}
              error={renameError}
              disabled={isRenaming}
              onKeyDown={handleRenameKeyDown}
              onChange={(value) => {
                setRenameValue(value ?? '');
                setRenameError(undefined);
              }}
            />
          </div>
        </Popup>
      )}
      {deleteRow && (
        <DeleteConfirmationDialog
          open
          title={labels.deleteTitle(deleteRow.title)}
          names={[deleteRow.title]}
          message={labels.deleteDescription}
          labels={labels.deleteDialog}
          isLoading={isDeleting}
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
          onClose={handleDeleteClose}
        />
      )}
    </>
  );
};

/** A project's chat column: the host's chat input, the Chats list, and its rename and delete dialogs. */
export const ProjectConversationsPanel = memo(
  ProjectConversationsPanelComponent,
);
