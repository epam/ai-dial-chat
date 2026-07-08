import classNames from 'classnames';

interface BadgeProps {
  label: string;
  type?: 'error' | 'success' | 'warning' | 'disabled';
  className?: string;
}

export const Badge = ({ label, type, className }: BadgeProps) => (
  <span
    className={classNames(
      'rounded-full px-[6px] py-[2px] text-xxs font-bold uppercase leading-normal',
      {
        'bg-success text-success': type === 'success',
        'bg-error text-error': type === 'error',
        'bg-warning text-warning': type === 'warning',
        'bg-controls-disable-accent text-layer-0': type === 'disabled',
        'bg-accent-secondary text-primary': !type,
      },
      className,
    )}
    data-qa="creds-label"
  >
    {label}
  </span>
);
