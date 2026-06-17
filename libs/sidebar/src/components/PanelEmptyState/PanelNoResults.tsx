import { IconZoomCancel } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { PanelEmptyState } from './PanelEmptyState';

/** Props for `PanelNoResults`. */
export interface PanelNoResultsProps {
  /** Primary message shown beneath the icon. */
  label: string;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
  /** Icon component rendered above the label. Defaults to `IconZoomCancel`. */
  icon?: typeof IconZoomCancel;
  /** Icon size in px. Defaults to `45`. */
  iconSize?: number;
}

/** Empty-state block rendered when a search or filter produces no matches. */
export const PanelNoResults: FC<PanelNoResultsProps> = memo(
  ({ label, labelClassName, icon: Icon = IconZoomCancel, iconSize = 45 }) => (
    <PanelEmptyState
      icon={<Icon aria-hidden size={iconSize} stroke={1} />}
      label={label}
      styles={{ labelClassName }}
    />
  ),
);
