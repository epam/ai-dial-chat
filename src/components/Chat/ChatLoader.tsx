import classNames from 'classnames';

import { Spinner } from '../Common/Spinner';

interface Props {
  size?: number;
  slow?: boolean;
  containerClassName?: string;
  loaderClassName?: string;
  dataQa?: string;
}

export default function ChatLoader({
  size = 45,
  containerClassName,
  loaderClassName,
  dataQa = 'chat-loader',
}: Props) {
  return (
    <div
      className={classNames(
        'flex h-full w-full items-center justify-center',
        containerClassName,
      )}
    >
      <Spinner
        size={size}
        className={loaderClassName}
        dataQa={dataQa}
      />
    </div>
  );
}
