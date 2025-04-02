import { IconX } from '@tabler/icons-react';

import classNames from 'classnames';

interface Props {
  onClose: () => void;
  isLeftSide: boolean;
}

export const CloseSidebarButton: React.FC<Props> = ({
  onClose,
  isLeftSide,
}) => {
  return (
    <div
      className={classNames(
        'absolute top-0 z-50 p-[6px] xl:hidden',
        isLeftSide ? 'right-0 translate-x-full' : 'left-0 -translate-x-full',
      )}
    >
      <button
        onClick={onClose}
        className="cursor-pointer rounded-full bg-layer-3 p-[6px]"
        data-qa="close-sidebar"
      >
        <IconX size={24} className="text-primary" />
      </button>
    </div>
  );
};
