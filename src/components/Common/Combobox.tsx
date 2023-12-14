import {
  autoUpdate,
  flip,
  offset,
  size,
  useFloating,
} from '@floating-ui/react';
import { FC, createElement, useEffect, useLayoutEffect, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import ChevronDown from '../../../public/images/icons/chevron-down.svg';

import { useCombobox } from 'downshift';

interface Props<T = any> {
  items: T[];
  initialSelectedItem?: T;
  label?: string;
  placeholder?: string;
  notFoundPlaceholder?: string;
  itemRow?: FC<{ item: T }>;
  disabled?: boolean;
  getItemLabel: (item: T | undefined) => string;
  getItemValue: (item: T | undefined) => string;
  onSelectItem: (value: string) => void;
}

export const Combobox = ({
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
}: Props) => {
  const { t } = useTranslation(Translation.Common);
  const [displayedItems, setDisplayedItems] = useState(items);
  const [floatingWidth, setFloatingWidth] = useState(0);

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
    defaultSelectedItem: initialSelectedItem,
    itemToString: getItemLabel,
    onSelectedItemChange: ({ selectedItem: newSelectedItem }) => {
      onSelectItem(getItemValue(newSelectedItem));
      setInputValue('');
    },
    defaultInputValue: '',
  });

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
        <div className="relative flex rounded border border-primary focus-within:border-accent-primary ">
          <input
            disabled={disabled}
            placeholder={placeholder || ''}
            className="w-full bg-transparent px-3 py-2.5 outline-none placeholder:text-secondary"
            {...getInputProps({ ref: refs.reference as any })}
          />
          {!inputValue && itemRow && selectedItem && (
            <div className="pointer-events-none absolute left-3 top-2.5 flex items-center">
              {createElement(itemRow, { item: selectedItem })}
            </div>
          )}
          <button
            aria-label="toggle menu"
            className={`px-2 transition-all ${isOpen ? 'rotate-180' : ''}`}
            type="button"
            {...getToggleButtonProps()}
          >
            <ChevronDown height={18} width={18} />
          </button>
        </div>
      </div>
      <ul
        className={`z-10 max-h-80 overflow-auto rounded bg-layer-0 ${
          !isOpen && 'hidden'
        }`}
        {...getMenuProps(
          { ref: refs.floating as any },
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
                className={`flex cursor-pointer flex-col px-3 py-2 ${
                  highlightedIndex === index ? 'bg-accent-primary' : ''
                } ${selectedItem === item ? 'bg-accent-primary' : ''}`}
                key={`${getItemValue(item)}${index}`}
                {...getItemProps({ item, index })}
              >
                {itemRow
                  ? createElement(itemRow, { item })
                  : getItemLabel(item) || item.toString()}
              </li>
            ))
          ) : (
            <li className="px-3 py-2">
              {notFoundPlaceholder || t('No available items')}
            </li>
          ))}
      </ul>
    </div>
  );
};
