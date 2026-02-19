import classNames from 'classnames';

import { CloseButtonSmall } from '@/src/components/Common/CloseButtons';

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
      <CloseButtonSmall
        onClick={onClose}
        data-qa="close-sidebar"
        className="rounded-full bg-layer-3"
      />
    </div>
  );
};
