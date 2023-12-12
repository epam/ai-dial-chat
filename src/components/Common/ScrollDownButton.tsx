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
        className="bg-gray-100 hover:bg-gray-400 flex h-full w-full items-center justify-center rounded-full p-2"
        onClick={onScrollDownClick}
      >
        <IconArrowDown width={24} height={24} />
      </button>
    </div>
  );
};
