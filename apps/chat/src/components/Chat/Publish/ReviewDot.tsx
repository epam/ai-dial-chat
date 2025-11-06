import classNames from 'classnames';

interface Props {
  className?: string;
}

export function ReviewDot({ className }: Props) {
  return (
    <span className="absolute -left-px bottom-[-2px] z-10 flex size-[10px] items-center justify-center rounded-full bg-layer-3">
      <span className={classNames('rounded-full', className)}>
        <svg
          width="4"
          height="4"
          viewBox="0 0 4 4"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="m-[3px] rounded-[1px] bg-accent-primary"
        >
          <rect width="4" height="4" rx="1" />
        </svg>
      </span>
    </span>
  );
}
