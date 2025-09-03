import classNames from 'classnames';

type ButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onClick'
>;

interface Props<T> extends ButtonProps {
  tabKey: T;
  selected?: boolean;
  dataQA?: string;
  onClick: (key: T) => void;
}

export const TabButton = <T,>({
  tabKey,
  children,
  selected,
  dataQA,
  className,
  disabled,
  onClick,
  ...rest
}: Props<T>) => (
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
    onClick={() => onClick(tabKey)}
  >
    {children}
  </button>
);
