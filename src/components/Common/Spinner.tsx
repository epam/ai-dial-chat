import { IconLoader } from '@tabler/icons-react';

import classNames from 'classnames';

interface Props {
  size?: number;
  className?: string;
  slow?: boolean;
  dataQa?: string;
}

export const Spinner = ({
  size = 16,
  className = '',
  slow = false,
  dataQa = 'message-input-spinner',
}: Props) => {
  return (
    <IconLoader
      size={size}
      className={classNames(
        'shrink-0 grow-0 basis-auto text-secondary',
        slow ? 'animate-spin-slow' : 'animate-spin',
        className,
      )}
      data-qa={dataQa}
    />
  );
};
