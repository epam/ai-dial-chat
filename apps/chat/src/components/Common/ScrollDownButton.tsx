import { IconArrowDown } from '@tabler/icons-react';

import classNames from 'classnames';

import { DialButton } from '@epam/ai-dial-ui-kit';

interface Props {
  onScrollDownClick: () => void;
  className?: string;
}
export const ScrollDownButton = ({ onScrollDownClick, className }: Props) => {
  return (
    <div className={classNames('absolute aspect-square h-11', className)}>
      <DialButton
        data-qa="scroll-down-button"
        className="rounded-full bg-layer-3 p-2 hover:bg-layer-4"
        onClick={onScrollDownClick}
        iconBefore={<IconArrowDown size={24} />}
      />
    </div>
  );
};
