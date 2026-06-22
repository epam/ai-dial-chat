import { IconCaretRightFilled, IconChevronRight } from '@tabler/icons-react';

import classNames from 'classnames';

interface CaretIconComponentProps {
  hidden?: boolean;
  isOpen: boolean;
  size?: number;
  showOnHoverOnly?: boolean;
  arrowView?: boolean;
  iconClassName?: string;
}

export function CaretIconComponent({
  isOpen,
  size = 10,
  hidden,
  showOnHoverOnly,
  arrowView,
  iconClassName,
}: CaretIconComponentProps) {
  const Icon = arrowView ? IconChevronRight : IconCaretRightFilled;

  return (
    <span className={classNames(hidden ? 'invisible' : 'visible')}>
      <Icon
        className={classNames(
          'text-secondary transition-all',
          isOpen && 'rotate-90',
          showOnHoverOnly || hidden
            ? 'invisible group-hover/modal:[visibility:inherit] group-hover/sidebar:[visibility:inherit]'
            : 'visible',
          iconClassName,
        )}
        size={size}
      />
    </span>
  );
}
