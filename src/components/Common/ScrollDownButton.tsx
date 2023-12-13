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
        className="flex h-full w-full items-center justify-center rounded-full bg-layer-3 p-2 hover:bg-layer-4"
        onClick={onScrollDownClick}
      >
        <IconArrowDown width={24} height={24} />
      </button>
    </div>
  );
};
