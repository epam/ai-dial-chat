import { IconArrowDown } from '@tabler/icons-react';

import classNames from 'classnames';

interface Props {
  onScrollDownClick: () => void;
  className?: string;
}
export const ScrollDownButton = ({ onScrollDownClick, className }: Props) => {
  return (
    <div className={classNames('absolute aspect-square h-11', className)}>
      <button
        data-qa="scroll-down-button"
        className="flex size-full items-center justify-center rounded-full bg-layer-4 p-2 text-primary-bg-dark hover:bg-layer-3"
        onClick={onScrollDownClick}
      >
        <IconArrowDown width={24} height={24} />
      </button>
    </div>
  );
};
