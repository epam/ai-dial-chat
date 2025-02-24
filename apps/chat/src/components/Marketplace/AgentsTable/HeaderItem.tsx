import { IconArrowNarrowDown, IconArrowNarrowUp } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { TableColumnSortKeys } from '@/src/constants/marketplace';

interface Props {
  label: string;
  sortKey?: TableColumnSortKeys;
  size?: number;
  selectedSort?: 'asc' | 'desc';
  onApplySorting: (column: TableColumnSortKeys) => void;
}

export const HeaderItem: React.FC<Props> = ({
  label,
  sortKey,
  size,
  selectedSort,
  onApplySorting,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const SortIcon =
    selectedSort && selectedSort === 'desc'
      ? IconArrowNarrowDown
      : IconArrowNarrowUp;

  return (
    <button
      onClick={() =>
        !sortKey
          ? () => {
              return null;
            }
          : onApplySorting(sortKey)
      }
      className={classNames(
        'group flex items-center gap-2 font-semibold',
        !size && 'w-full min-w-full',
        !sortKey && 'cursor-default',
      )}
      style={size ? { width: `${size}px`, minWidth: `${size}px` } : undefined}
    >
      {t(label)}
      {sortKey && (
        <SortIcon
          className={
            selectedSort
              ? 'text-controls-permanent'
              : 'invisible text-secondary group-hover:visible'
          }
          size={16}
        />
      )}
    </button>
  );
};
