import { ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';

interface CollapsableSectionProps {
  name: string;
  openByDefault?: boolean;
  isHighlighted?: boolean;
  carentIconSize?: number;
  carentIconHidden?: boolean;
  children: ReactNode | ReactNode[];
  dataQa?: string;
  onToggle?: (isOpen: boolean) => void;
  className?: string;
  showOnHoverOnly?: boolean;
}

export default function CollapsableSection({
  name,
  openByDefault = true,
  isHighlighted = false,
  children,
  carentIconSize = 10,
  carentIconHidden,
  dataQa,
  onToggle,
  className,
  showOnHoverOnly,
}: CollapsableSectionProps) {
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
            ? 'text-pr-primary-700'
            : '[&:not(:hover)]:text-quaternary-bg-light',
        )}
        onClick={handleClick}
        data-qa={dataQa}
      >
        <CaretIconComponent
          isOpen={isOpened}
          size={carentIconSize}
          hidden={carentIconHidden}
          showOnHoverOnly={showOnHoverOnly}
        />
        {name}
      </div>
      {isOpened && children}
    </div>
  );
}
