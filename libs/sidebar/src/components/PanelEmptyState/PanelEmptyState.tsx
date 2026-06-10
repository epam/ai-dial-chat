import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { memo, type FC, type ReactNode } from 'react';

/** Props for `PanelEmptyState`. */
export interface PanelEmptyStateProps {
  /** Icon element rendered above the label. */
  icon: ReactNode;
  /** Primary message shown beneath the icon. */
  label: string;
  /** Typography class applied to the label. Defaults to `'dial-small-text'`. */
  labelClassName?: string;
}

/** Centered empty-state block for use inside a sidebar panel body. */
export const PanelEmptyState: FC<PanelEmptyStateProps> = memo(
  ({ icon, label, labelClassName = 'dial-small-text' }) => (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-secondary">
      {icon}
      <p className={mergeClasses('text-center text-primary', labelClassName)}>
        {label}
      </p>
    </div>
  ),
);
