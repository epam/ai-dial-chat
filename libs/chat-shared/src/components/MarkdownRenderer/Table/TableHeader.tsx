import { ElementSize, GhostIconButton, Tooltip } from '@epam/ai-dial-ui-kit';
import type { FC, ReactNode } from 'react';
import { mergeClasses } from '../../../utils/merge-class';
import styles from './TableHeader.module.scss';

/** A single action rendered by {@link TableHeader}. */
export interface TableHeaderAction {
  /** Stable accessible name and tooltip text. */
  label: string;
  /** Decorative icon content rendered inside the action button. */
  icon: ReactNode;
  /** Called when the action button is activated. */
  onClick: () => void;
}

/** Props for {@link TableHeader}. */
export interface TableHeaderProps {
  /** Content rendered at the inline start of the header. */
  children?: ReactNode;
  /** Action descriptors rendered as icon buttons at the inline end. */
  actions?: TableHeaderAction[];
  /** Extra classes merged onto the header. */
  className?: string;
}

/** Reusable table header with caller-supplied leading content and actions. */
export const TableHeader: FC<TableHeaderProps> = ({
  children,
  actions,
  className,
}) => (
  <div
    className={mergeClasses(
      'flex min-h-10 items-center gap-2 border-b px-2 py-2',
      styles.tableHeader,
      className,
    )}
  >
    {children != null && <div className="min-w-0 flex-1">{children}</div>}
    {actions != null && (
      <div className="ms-auto flex items-center gap-1">
        {actions.map((action) => (
          <Tooltip key={action.label} tooltip={action.label} asChild>
            <GhostIconButton
              aria-label={action.label}
              icon={
                <span aria-hidden className="flex items-center">
                  {action.icon}
                </span>
              }
              size={ElementSize.Small}
              onClick={action.onClick}
            />
          </Tooltip>
        ))}
      </div>
    )}
  </div>
);
