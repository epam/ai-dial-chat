import { DialNoDataContent } from '@epam/ai-dial-ui-kit';
import { memo, type FC, type ReactNode } from 'react';

/** Props for `PanelEmptyState`. */
export interface PanelEmptyStateProps {
  /** Icon element rendered above the label. */
  icon: ReactNode;
  /** Primary message shown beneath the icon. */
  label: string;
}

/** Centered empty-state block for use inside a sidebar panel body. */
export const PanelEmptyState: FC<PanelEmptyStateProps> = memo(
  ({ icon, label }) => {
    return <DialNoDataContent title={label} icon={icon} />;
  },
);
