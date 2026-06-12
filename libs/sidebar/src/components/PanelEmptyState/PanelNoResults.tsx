import { IconZoomCancel } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { PanelEmptyState } from './PanelEmptyState';

/** Props for `PanelNoResults`. */
export interface PanelNoResultsProps {
  /** Primary message shown beneath the icon. */
  label: string;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
}

/** Empty-state block rendered when a search or filter produces no matches. */
export const PanelNoResults: FC<PanelNoResultsProps> = memo(
  ({ label, labelClassName }) => (
    <PanelEmptyState
      icon={<IconZoomCancel aria-hidden size={45} stroke={1} />}
      label={label}
      labelClassName={labelClassName}
    />
  ),
);
