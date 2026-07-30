import { IconChevronDown, IconX } from '@tabler/icons-react';
import React, { FC } from 'react';
import {
  DropdownIndicatorProps,
  GroupBase,
  MultiValueGenericProps,
  MultiValueRemoveProps,
  components,
} from 'react-select';
import RSCreatableSelect, { CreatableProps } from 'react-select/creatable';

import classNames from 'classnames';

import { DropdownSelectorOption } from '@/src/types/common';

import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Tooltip } from '@/src/components/Common/Tooltip';

const MultiValueContainer = (
  props: MultiValueGenericProps<DropdownSelectorOption>,
) => (
  <div data-qa="combobox-pill">
    <components.MultiValueContainer {...props} />
  </div>
);

const MultiValueRemove = (
  props: MultiValueRemoveProps<DropdownSelectorOption>,
) => {
  const { ref: __ref, ...innerProps } = props.innerProps;

  return (
    <button
      type="button"
      className="flex items-center text-primary hover:text-accent-primary"
      aria-label={`unselect ${props.data.value}`}
      {...(innerProps as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      data-qa={`unselect-item-${props.data.value}`}
    >
      <IconX size={DEFAULT_ICON_SIZES.SMALL} stroke={1.5} />
    </button>
  );
};

const DropdownIndicator = (
  props: DropdownIndicatorProps<DropdownSelectorOption, true>,
) => (
  <components.DropdownIndicator {...props}>
    <IconChevronDown
      size={20}
      className={classNames(
        'shrink-0 transition-transform',
        props.selectProps.menuIsOpen && 'rotate-180',
      )}
    />
  </components.DropdownIndicator>
);

type CreatableSelectProps = CreatableProps<
  DropdownSelectorOption,
  true,
  GroupBase<DropdownSelectorOption>
> & {
  id?: string;
  tooltip?: string;
  className?: string;
  dataQa?: string;
};

export const CreatableSelect: FC<CreatableSelectProps> = ({
  id,
  tooltip,
  className,
  dataQa,
  ...props
}) => {
  return (
    <Tooltip tooltip={tooltip}>
      <div data-qa={dataQa}>
        <RSCreatableSelect<DropdownSelectorOption, true>
          {...props}
          unstyled
          isMulti
          isClearable
          inputId={id}
          components={{
            MultiValueContainer,
            MultiValueRemove,
            DropdownIndicator,
          }}
          menuPortalTarget={
            typeof document !== 'undefined' ? document.body : undefined
          }
          menuPosition="fixed"
          styles={{ menuPortal: (base) => ({ ...base, zIndex: 60 }) }}
          classNames={{
            control: () =>
              classNames(
                'input-form input-invalid peer mx-0 flex min-h-[31px] items-start py-1 pl-0 md:max-w-full',
                className,
              ),
            valueContainer: () => 'flex flex-wrap items-center gap-1 p-1',
            placeholder: () => 'pl-1 text-secondary',
            input: () => 'text-primary',
            multiValue: () =>
              'flex h-[31px] items-center gap-2 rounded bg-accent-primary-alpha px-3',
            multiValueLabel: () => 'max-w-[150px] truncate break-all text-xs',
            multiValueRemove: () => 'hover:text-accent-primary',
            indicatorsContainer: () => 'flex items-center',
            clearIndicator: () =>
              'cursor-pointer text-primary hover:text-accent-primary',
            menu: () =>
              'z-10 mt-1 max-h-80 overflow-auto rounded bg-layer-3 shadow',
            option: ({ isFocused }) =>
              classNames(
                'flex cursor-pointer items-center whitespace-break-spaces break-words p-3 text-xs',
                isFocused && 'bg-accent-primary-alpha',
              ),
            noOptionsMessage: () => 'px-3 py-2 text-xs text-secondary',
            loadingMessage: () => 'px-3 py-2 text-xs text-secondary',
          }}
        />
      </div>
    </Tooltip>
  );
};
