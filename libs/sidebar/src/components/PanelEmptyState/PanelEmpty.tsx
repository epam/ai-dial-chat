import { IconMessageCircle } from '@tabler/icons-react';
import { memo, type FC } from 'react';
import { PanelEmptyState } from './PanelEmptyState';

/** Props for `PanelEmpty`. */
export interface PanelEmptyProps {
  /** Primary message shown beneath the icon. */
  label: string;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
  /** Icon component rendered above the label. Defaults to `IconMessageCircle`. */
  icon?: typeof IconMessageCircle;
  /** Icon size in px. Defaults to `48`. */
  iconSize?: number;
}

/** Empty-state block rendered when a panel has no items at all. */
export const PanelEmpty: FC<PanelEmptyProps> = memo(
  ({
    label,
    labelClassName,
    icon: Icon = IconMessageCircle,
    iconSize = 48,
  }) => (
    <PanelEmptyState
      icon={<Icon aria-hidden size={iconSize} stroke={1} />}
      label={label}
      styles={{ labelClassName }}
    />
  ),
);
