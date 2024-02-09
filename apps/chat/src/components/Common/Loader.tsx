import classNames from 'classnames';

import { Spinner } from './Spinner';

interface Props {
  size?: number;
  containerClassName?: string;
  loaderClassName?: string;
  dataQa?: string;
}

export default function Loader({
  size = 45,
  containerClassName,
  loaderClassName,
  dataQa = 'chat-loader',
}: Props) {
  return (
    <div
      className={classNames(
        'flex w-full items-center justify-center',
        containerClassName || 'h-full',
      )}
    >
      <Spinner size={size} className={loaderClassName} dataQa={dataQa} />
    </div>
  );
}
