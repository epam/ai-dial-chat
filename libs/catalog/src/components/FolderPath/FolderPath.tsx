import { mergeClasses } from '@epam/ai-dial-chat-shared';
import { DIAL_ICON_SIZE, DialBreadcrumb, DialIcon } from '@epam/ai-dial-ui-kit';
import { IconChevronRight, IconFolder } from '@tabler/icons-react';
import { FC } from 'react';
import styles from './FolderPath.module.scss';

/** Props for FolderPath. */
export interface FolderPathProps {
  /** Folder breadcrumb segments, outermost first. */
  segments: string[];
  /** CSS class applied to each breadcrumb label. Default: 'dial-small-text text-secondary'. */
  labelClassName?: string;
  /** CSS class for the last (leaf) segment. Default: 'dial-small-semi-text'. */
  leafClassName?: string;
  /**
   * CSS class for the breadcrumb's `<nav>` container. `DialBreadcrumb`
   * scrolls horizontally on overflow, so its `<nav>` must keep a definite,
   * non-shrunk width (its default full width, or a parent-resolved size) —
   * do not size it to content (e.g. via `w-auto`), since a scroll container
   * reports a collapsed intrinsic size to auto-sizing algorithms and will
   * truncate.
   */
  className?: string;
}

/**
 * Renders folder segments as a read-only (non-clickable) DialBreadcrumb.
 * DialBreadcrumb scrolls horizontally on overflow rather than truncating.
 */
export const FolderPath: FC<FolderPathProps> = ({
  segments,
  labelClassName = 'dial-small-text',
  leafClassName = 'dial-small-semi-text',
  className,
}) => {
  const folderIcon = (
    <DialIcon
      icon={<IconFolder size={DIAL_ICON_SIZE.SM} />}
      className={styles.icon}
    />
  );
  const pathItems = segments.map((seg, i) => ({
    label:
      i === segments.length - 1 ? (
        <span className={leafClassName}>{seg}</span>
      ) : (
        seg
      ),
    disabled: true,
    ...(i === 0 ? { iconBefore: folderIcon } : {}),
  }));

  return (
    <DialBreadcrumb
      className={className}
      separator={
        <DialIcon
          icon={<IconChevronRight size={14} className="rtl:scale-x-[-1]" />}
          className={styles.icon}
        />
      }
      pathItems={pathItems}
      labelClassName={mergeClasses(
        labelClassName,
        styles.label,
        '!cursor-default',
      )}
    />
  );
};
