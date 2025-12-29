import {
  autoUpdate,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { ComponentType, useCallback, useMemo, useState } from 'react';

import classNames from 'classnames';

import { getEntityStatus } from '@/src/utils/marketplace';

import { MarketplaceEntity } from '@/src/types/marketplace';

import {
  ESCAPE_KEY_PRESS,
  OUTSIDE_PRESS_AND_MOUSE_EVENT,
} from '@/src/constants/modal';

import { DialButton } from '@epam/ai-dial-ui-kit';

export interface HiddenItem<T> {
  id: string;
  data?: T;
}

export interface ItemComponentProps<T> {
  id: string;
  item?: T;
  onRemove: (id: string) => void;
  onItemClick?: (id: string) => void;
}

interface OverflowButtonProps<T> {
  hiddenItems: HiddenItem<T>[];
  onRemove: (id: string) => void;
  onItemClick?: (id: string) => void;
  ItemComponent: ComponentType<ItemComponentProps<T>>;
}

export const OverflowButton = <T,>({
  hiddenItems,
  onRemove,
  onItemClick,
  ItemComponent,
}: OverflowButtonProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasErrorInHiddenItems = useMemo(() => {
    return hiddenItems.some(({ data }) => {
      const { isError } = getEntityStatus(data as MarketplaceEntity);
      return isError;
    });
  }, [hiddenItems]);

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

  const handleItemClickAndClose = useCallback(
    (id: string) => {
      onItemClick?.(id);
      setIsOpen(false);
    },
    [onItemClick],
  );

  return (
    <>
      <DialButton
        ref={refs.setReference}
        {...getReferenceProps()}
        className={classNames(
          'box-border flex h-[34px] shrink-0 items-center rounded border px-3 py-1.5 transition-colors',
          {
            'bg-error text-error hover:border-error': hasErrorInHiddenItems,
            'border-error': hasErrorInHiddenItems && isOpen,
            'border-transparent': !isOpen,

            'bg-accent-primary-alpha text-primary hover:border-accent-primary':
              !hasErrorInHiddenItems,
            'border-accent-primary': !hasErrorInHiddenItems && isOpen,
            'border-secondary': !hasErrorInHiddenItems && !isOpen,
          },
        )}
        label={`+${hiddenItems.length}`}
      />

      {isOpen && (
        <div
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps()}
          className="z-50 mt-1.5 max-h-[324px] w-[294px] rounded-md border border-tertiary bg-layer-1 shadow-lg"
        >
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {hiddenItems.map(({ id, data }) => (
              <ItemComponent
                key={id}
                id={id}
                item={data}
                onRemove={onRemove}
                onItemClick={handleItemClickAndClose}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
};
