import React from 'react';

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
        'absolute top-0 z-50 p-[6px] sidebar-overlay:hidden',
        isLeftSide
          ? 'end-0 translate-x-full rtl:-translate-x-full'
          : 'start-0 -translate-x-full rtl:translate-x-full',
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
