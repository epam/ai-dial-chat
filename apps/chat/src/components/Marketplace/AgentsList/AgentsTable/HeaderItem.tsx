import { IconArrowNarrowDown, IconArrowNarrowUp } from '@tabler/icons-react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { fakeCallback } from '@/src/utils/app/common';

import { SortOrder } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { TableColumnSortKeys } from '@/src/constants/marketplace';

interface Props {
  label: string;
  sortKey?: TableColumnSortKeys;
  size?: number;
  sortOrder?: SortOrder;
  onApplySorting: (column: TableColumnSortKeys) => void;
}

export const HeaderItem: React.FC<Props> = ({
  label,
  sortKey,
  size,
  sortOrder,
  onApplySorting,
}) => {
  const { t } = useTranslation(Translation.Marketplace);

  const SortIcon =
    sortOrder && sortOrder === 'desc' ? IconArrowNarrowDown : IconArrowNarrowUp;

  return (
    <button
      onClick={() => (!sortKey ? fakeCallback() : onApplySorting(sortKey))}
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
            sortOrder
              ? 'text-primary'
              : 'invisible text-secondary group-hover:visible'
          }
          size={16}
        />
      )}
    </button>
  );
};
