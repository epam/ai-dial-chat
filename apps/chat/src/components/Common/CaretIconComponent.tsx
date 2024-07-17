import { IconCaretRightFilled } from '@tabler/icons-react';

import classNames from 'classnames';

interface CaretIconComponentProps {
  hidden?: boolean;
  isOpen: boolean;
  size?: number;
  showOnHoverOnly?: boolean;
}

export default function CaretIconComponent({
  isOpen,
  size = 10,
  hidden,
  showOnHoverOnly,
}: CaretIconComponentProps) {
  return (
    <span className={classNames(hidden ? 'invisible' : 'visible')}>
      <IconCaretRightFilled
        className={classNames(
          'text-secondary-bg-dark transition-all',
          isOpen && 'rotate-90',
          showOnHoverOnly || hidden
            ? 'invisible group-hover/modal:[visibility:inherit] group-hover/sidebar:[visibility:inherit]'
            : 'visible',
        )}
        size={size}
      />
    </span>
  );
}
