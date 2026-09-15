import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';

/** Props for `PanelEmpty`. */
export interface PanelEmptyProps {
  /** Primary message of the empty state. */
  label: string;
}

/** Empty-state block rendered when a panel has no items at all. */
export const PanelEmpty: FC<PanelEmptyProps> = memo(({ label }) => (
  <PanelEmptyState label={label} />
));
