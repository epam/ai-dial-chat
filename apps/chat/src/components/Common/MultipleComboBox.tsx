import {
  autoUpdate,
  flip,
  offset,
  size,
  useFloating,
} from '@floating-ui/react';
import { IconX } from '@tabler/icons-react';
import {
  FC,
  RefObject,
  createElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import Tooltip from './Tooltip';

import { useCombobox, useMultipleSelection } from 'downshift';

interface getFilteredItemsArgs<T> {
  inputValue: string | undefined;
  getItemLabel: (item: T) => string;
  items?: T[];
  selectedItems?: T[];
}

function getFilteredItems<T>({
  inputValue,
  getItemLabel,
  items,
  selectedItems,
}: getFilteredItemsArgs<T>) {
  if (!items) {
    return !inputValue ||
      selectedItems?.some((item) => getItemLabel(item) === inputValue)
      ? []
      : [inputValue as T];
  }
  if (!selectedItems) {
    return items;
  } else {
    const lowerCasedInputValue = inputValue?.toLowerCase() || '';
    return items.filter(
      (item) =>
        !selectedItems.includes(item) &&
        getItemLabel(item).toLowerCase().includes(lowerCasedInputValue),
    );
  }
}

interface Props<T> {
  items?: T[];
  initialSelectedItems?: T[];
  label?: string;
  placeholder?: string;
  notFoundPlaceholder?: string;
  itemRow?: FC<{ item: T }>;
  selectedItemRow?: FC<{ item: T }>;
  disabled?: boolean;
  getItemLabel: (item: T) => string;
  getItemValue: (item: T) => string;
  onChangeSelectedItems: (value: T[]) => void;
  className?: string;
}

export function MultipleComboBox<T>({
  items,
  initialSelectedItems,
  label,
  placeholder,
  notFoundPlaceholder,
  itemRow,
  selectedItemRow,
  disabled,
  getItemLabel,
  getItemValue,
  onChangeSelectedItems,
  className,
}: Props<T>) {
  const { t } = useTranslation(Translation.Common);
  const [inputValue, setInputValue] = useState<string | undefined>('');
  const [floatingWidth, setFloatingWidth] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  const { x, y, refs, strategy, update } = useFloating({
    placement: 'bottom-start',
    strategy: 'fixed',
    middleware: [
      size({
        apply({ rects }) {
          setFloatingWidth(rects.reference.width);
        },
      }),
      offset(4),
      flip(),
    ],
  });

  const {
    getSelectedItemProps,
    getDropdownProps,
    removeSelectedItem,
    selectedItems,
    addSelectedItem,
  } = useMultipleSelection({
    selectedItems: initialSelectedItems || [],
    onStateChange({ selectedItems: newSelectedItems, type }) {
      switch (type) {
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.SelectedItemKeyDownDelete:
        case useMultipleSelection.stateChangeTypes.DropdownKeyDownBackspace:
        case useMultipleSelection.stateChangeTypes.FunctionRemoveSelectedItem:
          if (!newSelectedItems) {
            return;
          }
          onChangeSelectedItems(newSelectedItems);

          break;
        default:
          break;
      }
    },
  });

  const displayedItems = useMemo(
    () => getFilteredItems({ inputValue, getItemLabel, items, selectedItems }),
    [selectedItems, inputValue, items, getItemLabel],
  );

  const {
    isOpen,
    getLabelProps,
    getMenuProps,
    getInputProps,
    highlightedIndex,
    getItemProps,
    selectedItem,
  } = useCombobox({
    items: displayedItems,
    itemToString: (item: T | null) => (item ? getItemLabel(item) : 'null item'),
    defaultHighlightedIndex: 0, // after selection, highlight the first item.
    selectedItem: null,
    inputValue,
    stateReducer(_, actionAndChanges) {
      const { changes, type } = actionAndChanges;

      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          return {
            ...changes,
            isOpen: true, // keep the menu open after selection.
            highlightedIndex: 0, // with the first option highlighted.
          };
        default:
          return changes;
      }
    },
    onStateChange({
      inputValue: newInputValue,
      type,
      selectedItem: newSelectedItem,
    }) {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputBlur:
          if (!newSelectedItem) {
            return;
          }

          if (
            getItemLabel(newSelectedItem) &&
            !getItemLabel(newSelectedItem).trim()
          ) {
            return;
          }

          addSelectedItem(newSelectedItem);
          onChangeSelectedItems([...(selectedItems ?? []), newSelectedItem]);
          setInputValue('');

          break;

        case useCombobox.stateChangeTypes.InputChange:
          setInputValue(newInputValue);

          break;
        default:
          break;
      }
    },
  });

  useLayoutEffect(() => {
    if (isOpen && refs.reference.current && refs.floating.current) {
      return autoUpdate(refs.reference.current, refs.floating.current, update);
    }
  }, [isOpen, update, refs.floating, refs.reference]);

  return (
    <div
      className={classNames('relative w-full md:max-w-[205px]', className)}
      data-qa="multiple-combobox"
    >
      <div className="flex w-full flex-col gap-1">
        {label && (
          <label htmlFor="option-input" {...getLabelProps()}>
            {label}
          </label>
        )}
        <div
          ref={refs.reference as RefObject<HTMLDivElement>}
          onClick={() => {
            if (!inputRef.current) {
              return;
            }
            inputRef.current.focus();
          }}
          className={classNames(
            'relative flex w-full flex-wrap gap-1 rounded-primary border border-secondary bg-layer-2 p-1 shadow-primary placeholder:text-tertiary-bg-light hover:border-accent-quaternary',
            !readonly && 'focus-within:border-accent-quaternary',
          )}
        >
          {selectedItems &&
            selectedItems.map((selectedItemForRender, index) => {
              return (
                <Tooltip
                  key={`selected-item-${getItemLabel(
                    selectedItemForRender,
                  )}-${index}`}
                  tooltip={getItemLabel(selectedItemForRender).trim()}
                  contentClassName="text-xs"
                >
                  <span
                    className="flex h-[23px] items-center justify-between gap-2 rounded bg-accent-primary-alpha px-2 py-1.5"
                    {...getSelectedItemProps({
                      selectedItem: selectedItemForRender,
                      index,
                    })}
                  >
                    {selectedItemRow ? (
                      createElement(selectedItemRow, {
                        item: selectedItemForRender,
                      })
                    ) : (
                      <span className="max-w-[150px] truncate break-all text-xs">
                        {getItemLabel(selectedItemForRender)}
                      </span>
                    )}
                    <span
                      data-qa={`unselect-item-${getItemValue(
                        selectedItemForRender,
                      )}`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelectedItem(selectedItemForRender);
                      }}
                    >
                      <IconX
                        size={14}
                        className="text-tertiary-bg-light hover:text-primary-bg-light"
                      />
                    </span>
                  </span>
                </Tooltip>
              );
            })}
          <input
            name="option-input"
            disabled={disabled}
            placeholder={selectedItems.length ? '' : placeholder || ''}
            className={classNames(
              'w-full min-w-[10px] overflow-auto whitespace-break-spaces break-words bg-transparent text-xs outline-none placeholder:text-tertiary-bg-light',
              selectedItems.length ? 'pl-1' : 'pl-2',
            )}
            {...getInputProps({
              ...getDropdownProps({
                preventKeyAction: isOpen,
                ref: inputRef,
              }),
            })}
          />
        </div>

        <ul
          className={classNames(
            'z-10 max-h-80 overflow-auto rounded-primary border border-secondary bg-layer-2 shadow-primary',
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
          {displayedItems?.length > 0
            ? displayedItems.map((item, index) => (
                <li
                  className={classNames(
                    'group flex min-h-[31px] w-full cursor-pointer flex-col justify-center whitespace-break-spaces break-words px-3 text-xs',
                    highlightedIndex === index && 'bg-accent-primary-alpha',
                    selectedItem === item && 'bg-accent-primary-alpha',
                  )}
                  key={`${getItemValue(item)}${index}`}
                  {...getItemProps({ item, index })}
                >
                  {itemRow
                    ? createElement(itemRow, { item })
                    : getItemLabel(item)}
                </li>
              ))
            : !!inputValue?.length && (
                <li className="rounded-primary border border-secondary bg-layer-2 px-3 py-2 shadow-primary">
                  {notFoundPlaceholder || t('No available items')}
                </li>
              )}
        </ul>
      </div>
    </div>
  );
}
