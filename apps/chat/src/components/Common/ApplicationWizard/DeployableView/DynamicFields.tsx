import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import {
  ChangeEvent,
  FC,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import classNames from 'classnames';

import { SelectOption } from '@/src/types/common';

import { Menu, MenuItem } from '@/src/components/Common/DropdownMenu';
import { Input } from '@/src/components/Common/Forms/Field';

import { differenceBy } from 'lodash-es';

interface SelectorProps {
  value: SelectOption<string, string> | null;
  onChange: (v: SelectOption<string, string>) => void;
  options: SelectOption<string, string>[];
  placeholder?: string;
}

const Selector: FC<SelectorProps> = ({
  value,
  onChange,
  options,
  placeholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleOnChange = useCallback(
    (option: SelectOption<string, string>) => {
      onChange(option);
      setIsOpen(false);
    },
    [onChange, setIsOpen],
  );

  return (
    <Menu
      className="bg-layer-3"
      onOpenChange={setIsOpen}
      listClassName="rounded-none w-full"
      trigger={
        <div className="flex w-full justify-between gap-2 px-2 py-[6.5px] text-xs">
          {value?.label ?? placeholder ?? 'Select'}
          <IconChevronDown
            className={classNames(
              'shrink-0 text-primary transition-all',
              isOpen && 'rotate-180',
            )}
            width={18}
            height={18}
          />
        </div>
      }
    >
      <div className="w-full bg-layer-3">
        {options.map((option) => (
          <MenuItem
            key={option.value}
            className="max-w-full text-xs hover:bg-accent-primary-alpha"
            item={option.label}
            value={option.value}
            onClick={() => handleOnChange(option)}
          />
        ))}
      </div>
    </Menu>
  );
};

interface FeatureSelectorProps {
  creatable?: boolean;
  value?: SelectOption<string, string>[];
  onChange?: (v: SelectOption<string, string>[]) => void;
  options?: SelectOption<string, string>[];
}

const DynamicFields = forwardRef<HTMLDivElement, FeatureSelectorProps>(
  ({ creatable, value, onChange, options }, ref) => {
    const [selectValue, setSelectValue] = useState<SelectOption<
      string,
      string
    > | null>(null);
    const [creatableValue, setCreatableValue] = useState('');
    const [inputValue, setInputValue] = useState('');

    const [keyValue, contentValue] = useMemo(() => {
      if (creatable) return [creatableValue, inputValue];
      return [selectValue?.value, inputValue];
    }, [creatable, selectValue, inputValue, creatableValue]);

    const handleKeyChange = useCallback(
      (value: SelectOption<string, string> | ChangeEvent<HTMLInputElement>) => {
        if (creatable) {
          const event = value as ChangeEvent<HTMLInputElement>;
          setCreatableValue(event.target.value);
        } else {
          const selectValue = value as SelectOption<string, string>;
          setSelectValue(selectValue);
        }
      },
      [creatable, setCreatableValue, setSelectValue],
    );

    const handleInputChange = useCallback(
      (e: ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
      },
      [setInputValue],
    );

    const handleAddClick = useCallback(() => {
      if (
        keyValue &&
        contentValue &&
        !value?.find(({ label }) => label === keyValue)
      ) {
        onChange?.([
          ...(value ?? []),
          { label: keyValue, value: contentValue },
        ]);
        setCreatableValue('');
        setSelectValue(null);
        setInputValue('');
      }
    }, [
      value,
      onChange,
      setInputValue,
      setSelectValue,
      keyValue,
      contentValue,
    ]);

    const filteredOptions = useMemo(
      () =>
        differenceBy(options, value ?? [], ({ label }) => label.toLowerCase()),
      [options, value],
    );

    useEffect(() => {
      setCreatableValue('');
      setSelectValue(null);
      setInputValue('');
    }, [value]);

    return (
      <div className="flex flex-col gap-3" ref={ref}>
        <div className="flex items-center gap-1">
          {creatable ? (
            <Input
              onChange={handleKeyChange}
              value={creatableValue}
              className="grow"
              placeholder="Name"
            />
          ) : (
            <Selector
              value={selectValue}
              onChange={handleKeyChange}
              options={filteredOptions}
            />
          )}

          <Input
            onChange={handleInputChange}
            value={inputValue}
            className="grow"
            placeholder="Value"
          />

          <button
            disabled={!keyValue || !contentValue}
            type="button"
            onClick={handleAddClick}
            className="button button-primary"
          >
            <IconPlus size={18} />
          </button>
        </div>

        <div>
          {value?.map(({ label, value }) => (
            <div
              key={label}
              className="flex border-b border-primary p-1 text-sm text-primary last:border-0"
            >
              {`${label}: ${value}`}
            </div>
          ))}
        </div>
      </div>
    );
  },
);

DynamicFields.displayName = 'FeatureSelector';

export { DynamicFields };
