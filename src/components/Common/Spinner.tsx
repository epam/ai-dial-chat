import classNames from 'classnames';

interface Props {
  size?: number;
  className?: string;
}

export const Spinner = ({ size = 16, className = '' }: Props) => {
  return (
    <div
      className={classNames(
        'animate-spin rounded-full border-t-2 border-gray-500',
        className,
      )}
      data-qa="message-input-spinner"
      style={{ height: size, width: size }}
    ></div>
  );
};
