import classNames from 'classnames';

import LoaderIcon from '@/public/images/icons/loader.svg';

interface Props {
  size?: number;
  className?: string;
  dataQa?: string;
}

export const Spinner = ({
  size = 16,
  className = '',
  dataQa = 'message-input-spinner',
}: Props) => {
  return (
    <LoaderIcon
      size={size}
      height={size}
      width={size}
      className={classNames(
        'animate-spin-steps shrink-0 grow-0 basis-auto text-secondary',
        className,
      )}
      data-qa={dataQa}
    />
  );
};
