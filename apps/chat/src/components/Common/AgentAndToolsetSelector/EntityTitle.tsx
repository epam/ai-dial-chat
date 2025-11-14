import classNames from 'classnames';

interface EntityTitleProps {
  name: string;
  version?: string;
  isError: boolean;
  className?: string;
}

export const EntityTitle: React.FC<EntityTitleProps> = ({
  name,
  version,
  isError,
  className,
}) => {
  return (
    <div
      className={classNames('flex min-w-0 items-baseline gap-x-2', className)}
    >
      <span className="min-w-0 truncate">{name}</span>
      {version && (
        <span
          className={classNames(
            'truncate',
            'max-w-[50%]',
            isError ? 'text-error brightness-75' : 'text-secondary',
          )}
        >
          {version}
        </span>
      )}
    </div>
  );
};
