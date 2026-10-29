import { DeleteConfirmationDialog } from '@epam/ai-dial-chat-shared';
import { ButtonVariant, Input, Popup, PopupSize } from '@epam/ai-dial-ui-kit';
import {
  type FC,
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
  onOpen,
  onRename,
  onDelete,
  labels,
  listTypography,
}) => {
  const renameInputId = useId();
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
    setRenameRow(null);
    restoreTriggerFocus();
  }, [restoreTriggerFocus]);
  const handleDeleteClose = useCallback(() => {
    if (isDeleting) return;
    setDeleteRow(null);
    restoreTriggerFocus();
  }, [isDeleting, restoreTriggerFocus]);

  const handleRenameSave = useCallback(async () => {
    if (!renameRow || !onRename) return;
    const newTitle = renameValue.trim();
    if (!newTitle) {
      setRenameError(labels.renameEmptyError);
      return;
    }
    setIsRenaming(true);
    try {
      await onRename(renameRow.id, newTitle);
      handleRenameClose();
    } catch {
      /* The host reports the failure; the dialog stays open for another try. */
    } finally {
      setIsRenaming(false);
    }
  }, [
    handleRenameClose,
    labels.renameEmptyError,
    onRename,
    renameRow,
    renameValue,
  ]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteRow || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteRow.id);
      setDeleteRow(null);
      restoreTriggerFocus();
    } catch {
      /* The host reports the failure; the dialog stays open for another try. */
    } finally {
      setIsDeleting(false);
    }
  }, [deleteRow, onDelete, restoreTriggerFocus]);

  const renameButtons = useMemo(
    () => [
      {
        label: labels.renameSaveLabel,
        variant: ButtonVariant.Primary,
        disabled: isRenaming,
        onClick: () => {
          void handleRenameSave();
        },
      },
    ],
    [handleRenameSave, isRenaming, labels.renameSaveLabel],
  );

  return (
    <>
      {composer}
      <ProjectConversationList
        items={items}
        isLoading={isLoading}
        hasError={hasError}
        onRetry={onRetry}
        onOpen={onOpen}
        onRename={onRename ? handleRenameRequest : undefined}
        onDelete={onDelete ? handleDeleteRequest : undefined}
        labels={labels.list}
        typography={listTypography}
      />
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
