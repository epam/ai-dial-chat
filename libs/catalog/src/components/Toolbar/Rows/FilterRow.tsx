import {
  DIAL_ICON_SIZE,
  DialDangerButton,
  DialIcon,
} from '@epam/ai-dial-ui-kit';
import { IconFilter, IconX } from '@tabler/icons-react';
import { FC } from 'react';
import styles from '../Toolbar.module.scss';

interface FilterRowProps {
  clearAllLabel?: string;
  onClearFilters: () => void;
  isAnyFilterActive: boolean;
}
/** Browse filter row — only rendered when at least one filter is active. */
export const FilterRow: FC<FilterRowProps> = ({
  isAnyFilterActive,
  onClearFilters,
  clearAllLabel = 'Clear all',
}) => {
  if (!isAnyFilterActive) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4">
      <DialIcon
        icon={<IconFilter size={DIAL_ICON_SIZE.MD} />}
        className={styles.icon}
      />
      {/* TODO: implement topic filters? */}
      <DialDangerButton
        label={clearAllLabel}
        iconBefore={<IconX size={DIAL_ICON_SIZE.SM} />}
        className={styles.clearAll}
        onClick={onClearFilters}
      />
    </div>
  );
};
