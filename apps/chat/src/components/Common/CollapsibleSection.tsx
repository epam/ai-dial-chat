import { ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';

interface CollapsibleSectionProps {
  name: string;
  openByDefault?: boolean;
  isHighlighted?: boolean;
  caretIconSize?: number;
  caretIconHidden?: boolean;
  children: ReactNode | ReactNode[];
  dataQa?: string;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
  showOnHoverOnly?: boolean;
  togglerClassName?: string;
}

export default function CollapsibleSection({
  name,
  openByDefault = true,
  isHighlighted = false,
  children,
  caretIconSize = 10,
  caretIconHidden,
  dataQa,
  onToggle,
  className,
  showOnHoverOnly,
  togglerClassName,
}: CollapsibleSectionProps) {
  const [isOpened, setIsOpened] = useState(openByDefault);
  const handleClick = useCallback(() => {
    onToggle && onToggle(!isOpened);
    setIsOpened((isOpen) => !isOpen);
  }, [isOpened, onToggle]);

  return (
    <div
      className={classNames('flex w-full flex-col py-1 pl-2 pr-0.5', className)}
      data-qa={dataQa?.concat('-container')}
    >
      <div
        className={classNames(
          'flex cursor-pointer items-center gap-1 whitespace-pre py-1 text-xs',
          isHighlighted
            ? 'text-accent-primary'
            : '[&:not(:hover)]:text-secondary',
          togglerClassName,
        )}
        onClick={handleClick}
        data-qa={dataQa}
      >
        <CaretIconComponent
          isOpen={isOpened}
          size={caretIconSize}
          hidden={caretIconHidden}
          showOnHoverOnly={showOnHoverOnly}
        />
        {name}
      </div>
      {isOpened && children}
    </div>
  );
}
