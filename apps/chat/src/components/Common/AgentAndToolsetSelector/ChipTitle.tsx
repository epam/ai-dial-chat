import classNames from 'classnames';

interface ChipTitleProps {
  name: string;
  version?: string;
  isError: boolean;
  className?: string;
}

export const ChipTitle: React.FC<ChipTitleProps> = ({
  name,
  version,
  isError,
  className,
}) => {
  return (
    <div
      className={classNames(
        'flex min-w-0 items-baseline justify-between gap-x-2',
        className,
      )}
    >
      <span
        className={classNames(
          'min-w-0 truncate',
          isError ? 'text-error' : 'text-primary',
        )}
      >
        {name}
      </span>
      {version && (
        <span
          className={classNames(
            'truncate',
            'min-w-8 max-w-[50%]',
            isError ? 'text-error brightness-75' : 'text-secondary',
          )}
        >
          {version}
        </span>
      )}
    </div>
  );
};
