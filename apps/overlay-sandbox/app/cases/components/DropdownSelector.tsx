'use client';

import { IconChevronDown, IconX } from '@tabler/icons-react';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import Select, { Props as SelectProps, components } from 'react-select';

export interface DropdownSelectorOption {
  readonly value: string;
  readonly label: string;
  readonly backgroundColor?: string;
  readonly borderColor?: string;
  readonly isFixed?: boolean;
  readonly isDisabled?: boolean;
}

type Props = SelectProps<DropdownSelectorOption, true> & {
  closeMenuOnSelect?: boolean;
};

export function DropdownSelector({
  closeMenuOnSelect = false,
  ...selectProps
}: Props) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient ? (
    <Select
      {...selectProps}
      closeMenuOnSelect={closeMenuOnSelect}
      name="colors"
      components={{
        ClearIndicator: (props) => (
          <button
            type="button"
            title="Remove all features"
            className="group cursor-pointer p-2"
            onClick={() => props.clearValue()}
            onTouchEnd={() => props.clearValue()}
          >
            <IconX
              className="text-secondary shrink-0  group-hover:text-red-500"
              data-qa="clear-dropdown-selection"
              size={18}
            />
          </button>
        ),
        MultiValueRemove: (props) => (
          <components.MultiValueRemove
            {...props}
            innerProps={{
              ...props.innerProps,
              style: {
                ...props.innerProps.style,
                backgroundColor: 'transparent',
              },
              className: 'group',
            }}
          >
            <IconX
              className="text-secondary cursor-pointer group-hover:text-red-500"
              size={16}
            />
          </components.MultiValueRemove>
        ),
        DropdownIndicator: (props) => (
          <button
            type="button"
            title="Features list"
            className="group flex cursor-pointer flex-row gap-1 p-2"
          >
            <span>Features list</span>
            <IconChevronDown
              className={classNames(
                'text-secondary shrink-0  group-hover:text-blue-500',
                props.selectProps.menuIsOpen && 'rotate-180',
              )}
              data-qa="open-dropdown-list"
              size={24}
            />
          </button>
        ),
      }}
      styles={{
        container: (styles) => ({
          ...styles,
          border: 'solid 1px #e5e7eb',
        }),
        indicatorsContainer: (styles) => ({
          ...styles,
          cursor: 'default',
          alignSelf: 'start',
          border: 'solid 1px #b2b2b2',
          borderBottom: '0',
          position: 'absolute',
          right: '0',
          top: '-25px',
          height: '25px',
        }),
        input: (styles) => ({
          ...styles,
          height: '21px',
          padding: 0,
          margin: 0,
        }),
        menu: (styles) => ({ ...styles, margin: 0 }),
        menuList: (styles) => ({
          ...styles,
          margin: 0,
          padding: 0,
          backgroundColor: '#ebeef2',
        }),
        option: (styles, state) => ({
          ...styles,
          WebkitTapHighlightColor: state.data.backgroundColor,
          backgroundColor: '',

          cursor: 'pointer',
          ':hover': {
            backgroundColor: state.data.backgroundColor ?? '#ffffff',
          },
          ':active': {
            backgroundColor: state.data.backgroundColor ?? '#ffffff',
          },
        }),

        indicatorSeparator: (styles, state) => ({
          ...styles,
          visibility: state.hasValue ? 'visible' : 'hidden',
          backgroundColor: '#b2b2b2',
          margin: '0px',
        }),
        multiValue: (styles, state) => ({
          ...styles,
          height: '30px',
          backgroundColor: state.data.backgroundColor ?? '#eeeeee',
          borderWidth: '1px',
          borderColor: state.data.borderColor,
          padding: '0 8px',
        }),
        multiValueLabel: (styles) => ({
          ...styles,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px',
        }),
        valueContainer: (styles) => ({
          ...styles,
          maxHeight: '300px',
          overflow: 'auto',
          padding: '4px',
          gap: '2px',
          backgroundColor: '#fff',
        }),
        placeholder: (styles) => ({
          ...styles,
          margin: 0,
        }),
        noOptionsMessage: (styles) => ({
          ...styles,
          textAlign: 'start',
        }),
        control: (styles, state) => ({
          ...styles,
          paddingLeft: state.hasValue ? 0 : '8px',
          display: 'flex',
          cursor: 'text',
          border: '1px solid #b2b2b2',
          boxShadow: 'none',
          transition: 'all 0',
          ':hover': {
            border: '1px solid #b2b2b2',
          },
        }),
        singleValue: (styles) => ({
          ...styles,
        }),
      }}
      noOptionsMessage={() => 'No options'}
    />
  ) : null;
}
