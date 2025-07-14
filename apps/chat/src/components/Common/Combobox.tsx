import {
  autoUpdate,
  flip,
  offset,
  size,
  useFloating,
} from '@floating-ui/react';
import {
  FC,
  RefObject,
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isMobile } from '@/src/utils/app/mobile';

import { Translation } from '@/src/types/translation';

import { Tooltip } from './Tooltip';

import ChevronDown from '@/public/images/icons/chevron-down.svg';
import { useCombobox } from 'downshift';

interface Props<T> {
  items: T[];
  initialSelectedItem?: T;
  label?: string;
  placeholder?: string;
  notFoundPlaceholder?: string;
  itemRow?: FC<{ item: T; truncate?: boolean }>;
  disabled?: boolean;
  getItemLabel: (item: T) => string;
  getItemValue: (item: T) => string;
  onSelectItem: (value: string) => void;
  inputClassName?: string;
  panelClassName?: string;
  indexSeparator?: number;
}

export const Combobox = <T,>({
  items,
  initialSelectedItem,
  label,
  placeholder,
  notFoundPlaceholder,
  itemRow,
  disabled,
  getItemLabel,
  getItemValue,
  onSelectItem,
  inputClassName,
  panelClassName,
  indexSeparator,
}: Props<T>) => {
  const { t } = useTranslation(Translation.Common);

  const [displayedItems, setDisplayedItems] = useState(items);
  const [floatingWidth, setFloatingWidth] = useState(0);

  const selectedItemRef = useRef<HTMLDivElement>(null);

  const { x, y, refs, strategy, update } = useFloating({
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      size({
        apply({ rects }) {
          setFloatingWidth(rects.reference.width + 35);
        },
      }),
      offset(4),
      flip(),
    ],
  });

  const {
    isOpen,
    getToggleButtonProps,
    getLabelProps,
    getMenuProps,
    getInputProps,
    getItemProps,
    highlightedIndex,
    selectedItem,
    inputValue,
    setInputValue,
  } = useCombobox({
    onInputValueChange({ inputValue }) {
      setDisplayedItems(
        items.filter((item) =>
          inputValue
            ? getItemLabel(item)
                .trim()
                .toLowerCase()
                .includes(inputValue.trim().toLowerCase())
            : true,
        ),
      );
    },
    items: displayedItems,
    selectedItem: initialSelectedItem,
    itemToString: (item: T | null) => (item ? getItemLabel(item) : 'null item'),
    onSelectedItemChange: ({ selectedItem: newSelectedItem }) => {
      if (!newSelectedItem) {
        return;
      }
      onSelectItem(getItemValue(newSelectedItem));
      setInputValue('');
    },
    defaultInputValue: '',
  });

  useEffect(() => {
    setInputValue('');
  }, [isOpen, setInputValue]);

  useEffect(() => {
    setDisplayedItems(
      items.filter((item) =>
        inputValue
          ? getItemLabel(item)
              .trim()
              .toLowerCase()
              .includes(inputValue.trim().toLowerCase())
          : true,
      ),
    );
  }, [getItemLabel, inputValue, items]);

  useLayoutEffect(() => {
    if (isOpen && refs.reference.current && refs.floating.current) {
      return autoUpdate(refs.reference.current, refs.floating.current, update);
    }
  }, [isOpen, update, refs.floating, refs.reference]);

  return (
    <div className="relative" data-qa="model-selector">
      <div className="flex w-full flex-col gap-1">
        {label && (
          <label className="w-fit" {...getLabelProps()}>
            {label}
          </label>
        )}
        <div
          className={classNames(
            'flex rounded border border-primary py-2.5 focus-within:border-accent-primary',
            inputClassName,
          )}
        >
          <div className="relative w-full" data-qa="selected-agent">
            <Tooltip
              tooltip={
                itemRow &&
                !!selectedItem &&
                createElement(itemRow, {
                  item: selectedItem,
                  truncate: false,
                })
              }
              hideTooltip={!!isOpen}
              triggerClassName="w-full"
              contentClassName="max-w-[300px] break-words"
              isTriggerClickable
            >
              <input
                readOnly={isMobile()}
                disabled={disabled}
                data-qa="search-input"
                placeholder={!selectedItem ? placeholder || '' : ''}
                className="w-full bg-transparent px-3 outline-none placeholder:text-secondary"
                style={{
                  ...(selectedItemRef.current && {
                    height: `${selectedItemRef.current.clientHeight}px`,
                  }),
                }}
                {...getInputProps({
                  ref: refs.reference as RefObject<HTMLInputElement>,
                })}
              />
            </Tooltip>
            {!inputValue && itemRow && !!selectedItem && (
              <div
                ref={selectedItemRef}
                className="pointer-events-none absolute left-3 top-0 flex w-full items-center"
              >
                {createElement(itemRow, { item: selectedItem })}
              </div>
            )}
          </div>
          <button
            aria-label="toggle menu"
            className={classNames(
              'px-2 transition-all',
              isOpen && 'rotate-180',
            )}
            type="button"
            {...getToggleButtonProps()}
          >
            <ChevronDown height={18} width={18} />
          </button>
        </div>
      </div>
      <ul
        className={classNames(
          'z-10 max-h-80 overflow-auto rounded bg-layer-3 shadow',
          panelClassName,
          !isOpen && 'hidden',
        )}
        {...getMenuProps(
          { ref: refs.floating as RefObject<HTMLUListElement> },
          { suppressRefError: true },
        )}
        style={{
          position: strategy,
          top: y ?? '',
          left: x ?? '',
          width: `${floatingWidth}px`,
        }}
      >
        {isOpen &&
          (displayedItems?.length > 0 ? (
            displayedItems.map((item, index) => (
              <li
                className={classNames(
                  'group flex h-[34px] cursor-pointer flex-col justify-center px-3',
                  highlightedIndex === index && 'bg-accent-primary-alpha',
                  selectedItem === item && 'bg-accent-primary-alpha',
                  !inputValue &&
                    indexSeparator &&
                    index === indexSeparator &&
                    'border-b border-secondary',
                )}
                key={`${getItemValue(item)}${index}`}
                {...getItemProps({ item, index })}
              >
                <Tooltip
                  tooltip={
                    itemRow
                      ? createElement(itemRow, { item, truncate: false })
                      : getItemLabel(item)
                  }
                  triggerClassName="w-full"
                  contentClassName="max-w-[300px] break-words"
                >
                  {itemRow
                    ? createElement(itemRow, { item })
                    : getItemLabel(item)}
                </Tooltip>
              </li>
            ))
          ) : (
            <li className="px-3 py-2" data-qa="no-available-items">
              {notFoundPlaceholder || t('No available items')}
            </li>
          ))}
      </ul>
    </div>
  );
};
