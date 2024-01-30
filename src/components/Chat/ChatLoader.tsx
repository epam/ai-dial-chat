import classNames from 'classnames';

import { Spinner } from '../Common/Spinner';

interface Props {
  size?: number;
  slow?: boolean;
  containerClassName?: string;
  loaderClassName?: string;
}

export default function ChatLoader({
  size = 45,
  slow = true,
  containerClassName,
  loaderClassName,
}: Props) {
  return (
    <div
      className={classNames(
        'flex h-full w-full items-center justify-center',
        containerClassName,
      )}
    >
      <Spinner size={size} slow={slow} className={loaderClassName} />
    </div>
  );
}
