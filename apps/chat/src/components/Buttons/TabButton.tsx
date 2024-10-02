import classNames from 'classnames';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

interface Props extends ButtonProps {
  selected?: boolean;
  dataQA?: string;
}

export const TabButton = ({
  children,
  selected,
  dataQA,
  className,
  disabled,
  ...rest
}: Props) => (
  <button
    {...rest}
    className={classNames(
      className,
      'rounded px-3 py-2',
      selected
        ? 'border-accent-primary bg-accent-primary-alpha'
        : 'border-primary bg-layer-4 hover:border-transparent',
      disabled
        ? 'button border-transparent'
        : 'border-b-2 hover:bg-accent-primary-alpha',
    )}
    data-qa={dataQA ?? 'tab-button'}
    disabled={disabled}
  >
    {children}
  </button>
);
