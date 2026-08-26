import { PanelEmptyState } from '@epam/ai-dial-chat-shared';
import { IconFileSad } from '@tabler/icons-react';
import { memo, type FC } from 'react';

/** Props for `PanelNoResults`. */
export interface PanelNoResultsProps {
  /** Primary message shown beneath the icon. */
  label: string;
  /** Icon component rendered above the label. Defaults to `IconFileSad`. */
  icon?: typeof IconFileSad;
  /** Icon size in px. Defaults to `32`. */
  iconSize?: number;
}

/** Empty-state block rendered when a search or filter produces no matches. */
export const PanelNoResults: FC<PanelNoResultsProps> = memo(
  ({ label, icon: Icon = IconFileSad, iconSize = 32 }) => (
    <PanelEmptyState
      icon={<Icon aria-hidden size={iconSize} stroke={1} />}
      label={label}
      colors={{
        icon: 'var(--text-tertiary, #848e9c)',
        label: 'var(--text-secondary, #57647a)',
      }}
      containerClassName="pt-6"
    />
  ),
);
