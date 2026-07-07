import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { IconZoomCancel } from '@tabler/icons-react';
import { memo, type FC } from 'react';

/** Props for `PanelNoResults`. */
export interface PanelNoResultsProps {
  /** Primary message shown beneath the icon. */
  label: string;
  /** Icon component rendered above the label. Defaults to `IconZoomCancel`. */
  icon?: typeof IconZoomCancel;
  /** Icon size in px. Defaults to `45`. */
  iconSize?: number;
}

/** Empty-state block rendered when a search or filter produces no matches. */
export const PanelNoResults: FC<PanelNoResultsProps> = memo(
  ({ label, icon: Icon = IconZoomCancel, iconSize = 45 }) => (
    <PanelEmptyState
      icon={<Icon aria-hidden size={iconSize} stroke={1} />}
      label={label}
    />
  ),
);
