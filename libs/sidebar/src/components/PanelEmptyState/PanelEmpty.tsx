import { IconMessageCircle } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { PanelEmptyState } from './PanelEmptyState';

/** Props for `PanelEmpty`. */
export interface PanelEmptyProps {
  /** Primary message shown beneath the icon. */
  label: string;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
}

/** Empty-state block rendered when a panel has no items at all. */
export const PanelEmpty: FC<PanelEmptyProps> = memo(
  ({ label, labelClassName }) => (
    <PanelEmptyState
      icon={<IconMessageCircle aria-hidden size={48} stroke={1} />}
      label={label}
      labelClassName={labelClassName}
    />
  ),
);
