import classNames from 'classnames';

interface Props {
  total: number;
  count: number;
  wrapperClassName?: string;
  progressClassName?: string;
}

export const RatingProgressBar = ({
  total,
  count,
  wrapperClassName,
  progressClassName,
}: Props) => {
  return (
    <div
      className={classNames(
        'h-1.5 w-full overflow-hidden rounded bg-layer-4',
        wrapperClassName,
      )}
    >
      <div
        className={classNames(
          'h-1.5 w-full rounded bg-accent-secondary',
          progressClassName,
        )}
        style={{ width: `${(count / total) * 100}%` }}
      ></div>
    </div>
  );
};
