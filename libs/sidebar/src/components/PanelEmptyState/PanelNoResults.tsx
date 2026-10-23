import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';

/** Props for `PanelNoResults`. */
export interface PanelNoResultsProps {
  /** Primary message of the empty state, e.g. "No chats found". */
  label: string;
  /** Secondary line, e.g. "Try a different search term or check your filters." */
  description?: string;
}

/** Empty-state block rendered when a search or filter produces no matches. */
export const PanelNoResults: FC<PanelNoResultsProps> = memo(
  ({ label, description }) => (
    <PanelEmptyState
      label={label}
      description={description}
      containerClassName="pt-6"
    />
  ),
);
