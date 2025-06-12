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

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { Translation } from '@/src/types/translation';

import { Tooltip } from './Tooltip';

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
  placeholder?: string;
  notFoundPlaceholder?: string;
  itemRow?: FC<{ item: T }>;
  selectedItemRow?: FC<{ item: T }>;
  disabled?: boolean;
  hasDeleteAll?: boolean;
  itemHeightClassName?: string;
  fontSize?: string;
  className?: string;
  validationRegExp?: RegExp;
  hideSuggestions?: boolean;
  tooltip?: string;
  getItemLabel: (item: T) => string;
  getItemValue: (item: T) => string;
  onChangeSelectedItems: (value: T[]) => void;
  handleError?: () => void;
  handleClearError?: () => void;
  dataQa?: string;
}

export function MultipleComboBox<T>({
  items,
  initialSelectedItems,
  placeholder,
  notFoundPlaceholder,
  itemRow,
  selectedItemRow,
  disabled,
  hasDeleteAll = false,
  itemHeightClassName,
  fontSize = 'text-sm',
  className,
  validationRegExp,
  hideSuggestions,
  tooltip,
  getItemLabel,
  getItemValue,
  onChangeSelectedItems,
  handleError,
  handleClearError,
  dataQa,
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
    setSelectedItems,
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
      selectedItem: newSelectedItem = inputValue as T,
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

          if (
            validationRegExp &&
            typeof newSelectedItem === 'string' &&
            !validationRegExp.test(newSelectedItem)
          ) {
            handleError?.();
            return;
          }

          addSelectedItem(newSelectedItem);
          onChangeSelectedItems([...(selectedItems ?? []), newSelectedItem]);
          setInputValue('');

          break;

        case useCombobox.stateChangeTypes.InputChange:
          handleClearError?.();
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
    <Tooltip tooltip={tooltip}>
      <div
        className={classNames(
          'relative w-full bg-transparent md:max-w-[205px]',
          disabled && 'cursor-not-allowed',
          className,
        )}
        data-qa={dataQa}
      >
        <div className="flex w-full flex-col gap-1">
          <div
            ref={refs.reference as RefObject<HTMLDivElement>}
            onClick={() => {
              if (!inputRef.current) {
                return;
              }
              inputRef.current.focus();
            }}
            className="relative flex min-h-[31px] w-full flex-wrap gap-1 p-1"
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
                      className={classNames(
                        'flex items-center justify-between gap-2 rounded bg-accent-primary-alpha px-2 py-1.5',
                        itemHeightClassName ? itemHeightClassName : 'h-[23px]',
                      )}
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
                      <button
                        data-qa={`unselect-item-${getItemValue(
                          selectedItemForRender,
                        )}`}
                        disabled={disabled}
                        className={disabled ? 'cursor-not-allowed' : ''}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSelectedItem(selectedItemForRender);
                        }}
                      >
                        <IconX size={14} className="text-secondary" />
                      </button>
                    </span>
                  </Tooltip>
                );
              })}
            <input
              name="option-input"
              disabled={disabled}
              placeholder={selectedItems.length ? '' : placeholder || ''}
              className={classNames(
                'w-full min-w-[10px] overflow-auto whitespace-break-spaces break-words bg-transparent outline-none placeholder:text-secondary',
                selectedItems.length ? 'pl-1' : 'pl-2',
                disabled && 'cursor-not-allowed',
                fontSize,
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
              'z-10 max-h-80 overflow-auto rounded bg-layer-3',
              (hideSuggestions || !isOpen) && 'hidden',
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
                  <li className="px-3 py-2">
                    {notFoundPlaceholder || t('No available items')}
                  </li>
                )}
          </ul>
        </div>
        {hasDeleteAll && selectedItems.length > 0 ? (
          <button
            className={classNames('py-2', disabled && 'cursor-not-allowed')}
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedItems([]);
              onChangeSelectedItems([]);
            }}
          >
            <IconX height={18} width={18} />
          </button>
        ) : null}
      </div>
    </Tooltip>
  );
}
