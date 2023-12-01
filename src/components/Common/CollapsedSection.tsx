import { ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';

interface CollapsedSectionProps {
  name: string;
  openByDefault?: boolean;
  isHighlighted?: boolean;
  carentIconSize?: number;
  carentIconHidden?: boolean;
  children: ReactNode | ReactNode[];
  dataQa?: string;
  onToggle?: (isOpen: boolean) => void;
}

export default function CollapsedSection({
  name,
  openByDefault = true,
  isHighlighted = false,
  children,
  carentIconSize = 10,
  carentIconHidden,
  dataQa,
  onToggle,
}: CollapsedSectionProps) {
  const [isOpened, setIsOpened] = useState(openByDefault);
  const handleClick = useCallback(() => {
    onToggle && onToggle(!isOpened);
    setIsOpened((isOpen) => !isOpen);
  }, [isOpened, onToggle]);

  return (
    <div className="flex w-full flex-col py-1 pl-2 pr-0.5">
      <div
        className={classNames(
          'flex cursor-pointer items-center gap-1 py-1 text-xs',
          isHighlighted ? 'text-green' : '[&:not(:hover)]:text-gray-500',
        )}
        onClick={handleClick}
        data-qa={dataQa}
      >
        <CaretIconComponent
          isOpen={isOpened}
          size={carentIconSize}
          hidden={carentIconHidden}
        />
        {name}
      </div>
      {isOpened && children}
    </div>
  );
}
