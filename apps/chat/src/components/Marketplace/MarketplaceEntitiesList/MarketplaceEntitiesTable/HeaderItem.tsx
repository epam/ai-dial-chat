import { IconArrowNarrowDown, IconArrowNarrowUp } from '@tabler/icons-react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { fakeCallback } from '@/src/utils/app/common';

import { SortOrder } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { TableColumnSortKeys } from '@/src/constants/marketplace';

import { DialButton } from '@epam/ai-dial-ui-kit';

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
    <DialButton
      onClick={() => (!sortKey ? fakeCallback() : onApplySorting(sortKey))}
      className={classNames(
        'group flex items-center',
        !size && 'w-full min-w-full',
        !sortKey && 'cursor-default',
      )}
      style={size ? { width: `${size}px`, minWidth: `${size}px` } : undefined}
      label={t(label)}
      iconAfter={
        sortKey && (
          <SortIcon
            className={
              sortOrder
                ? 'text-primary'
                : 'invisible text-secondary group-hover:visible'
            }
            size={16}
          />
        )
      }
    />
  );
};
