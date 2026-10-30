import type { DeleteConfirmationDialogLabels } from '@epam/ai-dial-chat-shared';
import type { ReactNode } from 'react';
import type {
  ProjectConversationListItem,
  ProjectConversationListLabels,
  ProjectConversationListTypography,
} from './project-conversation-list-props';

/** Localized labels of the {@link ProjectConversationsPanel} dialogs. */
export interface ProjectConversationsPanelLabels {
  /** Strings of the Chats list. */
  list: ProjectConversationListLabels;
  /** Title of the rename dialog. */
  renameTitle: string;
  /** Label of the rename dialog's name input. */
  renameInputLabel: string;
  /** Inline error when the new name is empty. */
  renameEmptyError: string;
  /** Label of the rename dialog's save button. */
  renameSaveLabel: string;
  /** Label of the rename dialog's cancel button. Defaults to `'Cancel'`. */
  renameCancelLabel?: string;
  /** Title of the delete confirmation, built from the chat title. */
  deleteTitle: (title: string) => string;
  /** Body of the delete confirmation. */
  deleteDescription: string;
  /** Buttons and status strings of the delete confirmation. */
  deleteDialog?: DeleteConfirmationDialogLabels;
}

/** Props for the {@link ProjectConversationsPanel} component. */
export interface ProjectConversationsPanelProps {
  /** Content above the Chats list, typically the host's chat input; omitted when unset. */
  composer?: ReactNode;
  /** Conversations, in display order. */
  items: ProjectConversationListItem[];
  /** Shows the list's loading state. Defaults to `false`. */
  isLoading?: boolean;
  /** Shows the list's error state with a retry action. Defaults to `false`. */
  hasError?: boolean;
  /** Called from the retry action of the list's error state. */
  onRetry: () => void;
  /** More conversations exist after `items`; shows the list's load-more action when `onLoadMore` is set. Defaults to `false`. */
  hasMore?: boolean;
  /** Disables the list's load-more action while the next page loads. Defaults to `false`. */
  isLoadingMore?: boolean;
  /** Called from the list's load-more action. */
  onLoadMore?: () => void;
  /** Called with a conversation id when the user activates its row. */
  onOpen: (id: string) => void;
  /** Renames a conversation; the dialog stays open while it rejects. Rename is hidden when omitted. */
  onRename?: (id: string, newTitle: string) => Promise<void>;
  /** Deletes a conversation; the dialog stays open while it rejects. Delete is hidden when omitted. */
  onDelete?: (id: string) => Promise<void>;
  /** Localized labels. */
  labels: ProjectConversationsPanelLabels;
  /** Typography overrides of the Chats list. */
  listTypography?: ProjectConversationListTypography;
}
