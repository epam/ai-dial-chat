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
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { Translation } from '@/src/types/translation';

import { useCombobox, useMultipleSelection } from 'downshift';

interface Props<T> {
  items: T[];
  initialSelectedItems?: T[];
  label?: string;
  placeholder?: string;
  notFoundPlaceholder?: string;
  itemRow?: FC<{ item: T }>;
  selectedItemRow?: FC<{ item: T }>;
  disabled?: boolean;
  isHideDropdown?: boolean;
  getItemLabel: (item: T) => string;
  getItemValue: (item: T) => string;
  getFilteredItems?: (
    items: T[],
    inputValue: string | undefined,
    getItemLabel: (item: T) => string,
    selectedItems?: T[],
  ) => T[];
  onChangeSelectedItems: (value: T[]) => void;
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
  isHideDropdown,
  getItemLabel,
  getItemValue,
  onChangeSelectedItems,
  getFilteredItems,
}: Props<T>) {
  const { t } = useTranslation(Translation.Common);
  const [inputValue, setInputValue] = useState<string | undefined>('');

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
    getSelectedItemProps,
    getDropdownProps,
    removeSelectedItem,
    selectedItems,
    addSelectedItem,
  } = useMultipleSelection({
    selectedItems: initialSelectedItems,
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
    () =>
      getFilteredItems
        ? getFilteredItems(items, inputValue, getItemLabel, selectedItems)
        : [inputValue as T],
    [selectedItems, inputValue, items, getFilteredItems, getItemLabel],
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
    stateReducer(state, actionAndChanges) {
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
    <>
      <div className="relative w-full" data-qa="multiple-combobox">
        <div className="flex w-full flex-col gap-1">
          {label && (
            <label className="w-fit" {...getLabelProps()}>
              {label}
            </label>
          )}
          <div className="relative flex flex-wrap gap-1 rounded border border-primary p-1 focus-within:border-accent-primary">
            {selectedItems &&
              selectedItems.map((selectedItemForRender, index) => {
                return (
                  <span
                    className="flex items-center rounded bg-accent-primary-alpha px-3 py-1.5 text-xs"
                    key={`selected-item-${getItemLabel(
                      selectedItemForRender,
                    )}-${index}`}
                    {...getSelectedItemProps({
                      selectedItem: selectedItemForRender,
                      index,
                    })}
                  >
                    {selectedItemRow
                      ? createElement(selectedItemRow, {
                          item: selectedItemForRender,
                        })
                      : getItemLabel(selectedItemForRender)}
                    <span
                      data-qa={`unselect-item-${getItemValue(
                        selectedItemForRender,
                      )}`}
                      className="cursor-pointer px-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelectedItem(selectedItemForRender);
                      }}
                    >
                      <IconX height={12} width={12} />
                    </span>
                  </span>
                );
              })}
            <div className="flex grow">
              <input
                disabled={disabled}
                placeholder={placeholder || ''}
                className="w-full bg-transparent px-3 py-1 outline-none placeholder:text-secondary"
                {...getInputProps(
                  getDropdownProps({
                    preventKeyAction: isOpen,
                    ref: refs.reference as RefObject<HTMLInputElement>,
                  }),
                )}
              />
            </div>
          </div>
          <ul
            className={classNames(
              'z-10 max-h-80 overflow-auto rounded bg-layer-0',
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
              !isHideDropdown &&
              (displayedItems?.length > 0 ? (
                displayedItems.map((item, index) => (
                  <li
                    className={classNames(
                      'group flex h-[34px] cursor-pointer flex-col justify-center px-3',
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
              ) : (
                <li className="px-3 py-2">
                  {notFoundPlaceholder || t('No available items')}
                </li>
              ))}
          </ul>
        </div>
      </div>
    </>
  );
}
