import { MouseEventHandler, ReactNode } from 'react';

import classNames from 'classnames';

import { useShrinkWrapWidth } from '@/src/hooks/useShrinkWrapWidth';

interface Props {
  children: ReactNode;
  maxWidth: number;
  className?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

export const ShrinkWrappedTooltipContent = ({
  children,
  maxWidth,
  className,
  onClick,
}: Props) => {
  const { ref, width } = useShrinkWrapWidth();

  return (
    <div
      ref={ref}
      className={classNames('my-1 flex flex-wrap gap-2', className)}
      style={{ maxWidth, width }}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
