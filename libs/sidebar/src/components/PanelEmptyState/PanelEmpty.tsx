import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { memo, type FC, type ReactNode } from 'react';

/** Props for `PanelEmpty`. */
export interface PanelEmptyProps {
  /** Primary message of the empty state, e.g. "No chats yet". */
  label: string;
  /** Secondary line, e.g. "Chats will appear here once you start one." */
  description?: string;
  /** Optional way forward, such as a button, rendered under the text. */
  action?: ReactNode;
}

/** Empty-state block rendered when a panel has no items at all. */
export const PanelEmpty: FC<PanelEmptyProps> = memo(
  ({ label, description, action }) => (
    <PanelEmptyState label={label} description={description} action={action} />
  ),
);
