import { ReactNode } from 'react';

import classNames from 'classnames';

interface FeatureContainerProps {
  children: ReactNode | ReactNode[];
  className?: string;
}

export const FeatureContainer = ({
  children,
  className,
}: FeatureContainerProps) => (
  <span
    className={classNames('flex w-2/3 flex-row items-center gap-2', className)}
  >
    {children}
  </span>
);
