import { IconCaretRightFilled } from '@tabler/icons-react';

import classNames from 'classnames';

interface CaretIconComponentProps {
  hidden?: boolean;
  isOpen: boolean;
  size?: number;
}

export default function CaretIconComponent({
  isOpen,
  size = 10,
  hidden,
}: CaretIconComponentProps) {
  return (
    <span className={classNames(hidden ? 'invisible' : 'visible')}>
      <IconCaretRightFilled
        className={classNames(
          'invisible text-gray-500 transition-all group-hover/modal:[visibility:inherit] group-hover/sidebar:[visibility:inherit]',
          isOpen && 'rotate-90',
        )}
        size={size}
      />
    </span>
  );
}

