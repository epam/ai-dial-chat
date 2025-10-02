import {
  autoUpdate,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { useState } from 'react';

import classNames from 'classnames';

import { MarketplaceEntity } from '@/src/types/marketplace';

import {
  ESCAPE_KEY_PRESS,
  OUTSIDE_PRESS_AND_MOUSE_EVENT,
} from '@/src/constants/modal';

import { OverflowListItem } from './OverflowListItem';

interface OverflowButtonProps {
  hiddenItems: { id: string; data?: MarketplaceEntity }[];
  onRemove: (id: string) => void;
}

export const OverflowButton = ({
  hiddenItems,
  onRemove,
}: OverflowButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-end',
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    ...OUTSIDE_PRESS_AND_MOUSE_EVENT,
    ...ESCAPE_KEY_PRESS,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
  ]);

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        className={classNames(
          'box-border flex h-[34px] shrink-0 cursor-pointer items-center rounded bg-accent-primary-alpha px-3 py-1.5 text-primary',
          {
            'border border-accent-primary': isOpen,
            'border border-secondary hover:border-accent-primary': !isOpen,
          },
        )}
      >
        +{hiddenItems.length}
      </button>

      {isOpen && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className="z-50 mt-1.5 max-h-[324px] w-[294px] rounded-md border border-tertiary bg-layer-1 shadow-lg"
        >
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {hiddenItems.map(({ id, data }) => (
              <OverflowListItem
                key={id}
                id={id}
                item={data}
                onRemove={onRemove}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};
