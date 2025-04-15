import { IconHelp } from '@tabler/icons-react';
import { ReactNode, useCallback, useState } from 'react';

import classNames from 'classnames';

import CaretIconComponent from '@/src/components/Common/CaretIconComponent';

import Tooltip from './Tooltip';

interface CollapsibleSectionProps {
  name: string;
  children: ReactNode | ReactNode[];
  openByDefault?: boolean;
  isHighlighted?: boolean;
  caretIconSize?: number;
  caretIconHidden?: boolean;
  dataQa?: string;
  className?: string;
  showOnHoverOnly?: boolean;
  togglerClassName?: string;
  sectionTooltip?: ReactNode;
  additionalNode?: ReactNode;
  isExpanded?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

export default function CollapsibleSection({
  name,
  openByDefault = true,
  isHighlighted = false,
  children,
  caretIconSize = 10,
  caretIconHidden,
  dataQa,
  className,
  showOnHoverOnly,
  togglerClassName,
  sectionTooltip,
  additionalNode,
  isExpanded,
  onToggle,
}: CollapsibleSectionProps) {
  const [isOpened, setIsOpened] = useState(openByDefault);

  const expandState = isExpanded ?? isOpened;

  const handleClick = useCallback(() => {
    onToggle && onToggle(!expandState);
    setIsOpened(!expandState);
  }, [expandState, onToggle]);

  return (
    <div
      className={classNames('flex w-full flex-col py-1 pl-2 pr-0.5', className)}
      data-qa={dataQa?.concat('-container')}
    >
      <div className="flex items-center gap-1 py-1">
        <div
          onClick={handleClick}
          className={classNames(
            'flex cursor-pointer items-center gap-1 whitespace-pre py-1 text-xs',
            isHighlighted
              ? 'text-accent-primary'
              : '[&:not(:hover)]:text-secondary',
            togglerClassName,
          )}
          data-qa="section-root"
          aria-selected={isHighlighted}
        >
          <CaretIconComponent
            isOpen={expandState}
            size={caretIconSize}
            hidden={caretIconHidden}
            showOnHoverOnly={showOnHoverOnly}
          />
          {name}
        </div>
        {sectionTooltip && (
          <Tooltip
            tooltip={sectionTooltip}
            triggerClassName="flex shrink-0 text-secondary hover:text-accent-primary"
            contentClassName="max-w-[220px]"
            placement="top"
          >
            <IconHelp size={18} />
          </Tooltip>
        )}
        {additionalNode}
      </div>
      {expandState && children}
    </div>
  );
}
