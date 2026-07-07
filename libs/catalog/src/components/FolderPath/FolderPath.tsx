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
}

/**
 * Renders folder segments as a DialBreadcrumb.
 * DialBreadcrumb auto-truncates long paths to [first, …dropdown, last-2, last].
 */
export const FolderPath: FC<FolderPathProps> = ({
  segments,
  labelClassName = 'dial-small-text',
  leafClassName = 'dial-small-semi-text',
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
    ...(i === 0 ? { iconBefore: folderIcon } : {}),
  }));

  return (
    <DialBreadcrumb
      separator={
        <DialIcon
          icon={<IconChevronRight size={14} className="rtl:scale-x-[-1]" />}
          className={styles.icon}
        />
      }
      pathItems={pathItems}
      labelClassName={mergeClasses(labelClassName, styles.label)}
    />
  );
};
