import { IconLoader } from '@tabler/icons-react';

import classNames from 'classnames';

interface Props {
  size?: number;
  className?: string;
  slow?: boolean;
}

export const Spinner = ({ size = 16, className = '', slow = false }: Props) => {
  return (
    <IconLoader
      size={size}
      className={classNames(
        'shrink-0 grow-0 basis-auto text-secondary',
        slow ? 'animate-spin-slow' : 'animate-spin',
        className,
      )}
    />
  );
};
