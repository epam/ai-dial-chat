import { ButtonHTMLAttributes, FC } from 'react';

import classNames from 'classnames';

export const Button: FC<ButtonHTMLAttributes<HTMLButtonElement>> = ({
  children,
  className,
  type = 'button',
  ...props
}) => {
  return (
    <button
      type={type}
      className={classNames(
        '[&:not(:disabled)]:hover:text-accent-primary',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};
