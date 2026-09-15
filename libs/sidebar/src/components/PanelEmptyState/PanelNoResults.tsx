import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { memo, type FC } from 'react';

/** Props for `PanelNoResults`. */
export interface PanelNoResultsProps {
  /** Primary message of the empty state. */
  label: string;
}

/** Empty-state block rendered when a search or filter produces no matches. */
export const PanelNoResults: FC<PanelNoResultsProps> = memo(({ label }) => (
  <PanelEmptyState label={label} containerClassName="pt-6" />
));
