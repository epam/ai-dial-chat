import { IconX } from '@tabler/icons-react';
import Select, { components } from 'react-select';

import { useTranslation } from 'next-i18next';

import { DropdownSelectorOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

interface Props {
  options: DropdownSelectorOption[];
  placeholder: string;
  onChange: (options: readonly DropdownSelectorOption[]) => void;
  onGetOptionBgColor?: (value: string) => string;
  onGetOptionBorderColor?: (value: string) => string;
}

export function DropdownSelector({
  options,
  placeholder,
  onChange,
  onGetOptionBgColor,
  onGetOptionBorderColor,
}: Props) {
  const { t } = useTranslation(Translation.Common);

  return (
    <Select
      placeholder={placeholder}
      isMulti
      onChange={onChange}
      closeMenuOnSelect={false}
      name="colors"
      options={options}
      components={{
        ClearIndicator: (props) => (
          <button type="button" className="group p-2">
            <IconX
              className="shrink-0 text-secondary group-hover:text-accent-primary"
              onClick={() => props.clearValue()}
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
              className="cursor-pointer text-secondary group-hover:text-accent-primary"
              size={16}
            />
          </components.MultiValueRemove>
        ),
      }}
      styles={{
        indicatorsContainer: (styles) => ({ ...styles, cursor: 'default' }),
        input: (styles) => ({
          ...styles,
          height: '21px',
          padding: 0,
          margin: 0,
          color: 'var(--text-primary)',
        }),
        menu: (styles) => ({ ...styles, margin: 0 }),
        menuList: (styles) => ({
          ...styles,
          margin: 0,
          padding: 0,
          backgroundColor: 'var(--bg-layer-0)',
        }),
        option: (styles, state) => ({
          ...styles,
          WebkitTapHighlightColor: onGetOptionBgColor
            ? onGetOptionBgColor(state.data.value)
            : 'var(--bg-accent-primary-alpha)',
          backgroundColor: '',
          cursor: 'pointer',
          ':hover': {
            backgroundColor: onGetOptionBgColor
              ? onGetOptionBgColor(state.data.value)
              : 'var(--bg-layer-4)',
          },
        }),
        dropdownIndicator: (styles, state) => ({
          ...styles,
          transition: 'all',
          transitionDuration: '200ms',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : '',
          ':hover': {
            color: 'var(--text-primary)',
          },
        }),
        indicatorSeparator: (styles, state) => ({
          ...styles,
          visibility: state.hasValue ? 'visible' : 'hidden',
          backgroundColor: 'var(--text-secondary)',
        }),
        multiValue: (styles, state) => ({
          ...styles,
          margin: '0 4px 0 0',
          height: '28px',
          backgroundColor: onGetOptionBgColor
            ? onGetOptionBgColor(state.data.value)
            : 'var(--bg-layer-4)',
          borderWidth: '1px',
          borderColor: onGetOptionBorderColor
            ? onGetOptionBorderColor(state.data.value)
            : `var(--bg-layer-4)`,
          padding: '0 8px',
        }),
        multiValueLabel: (styles) => ({
          ...styles,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 4px',
          color: 'var(--text-primary)',
        }),
        valueContainer: (styles) => ({
          ...styles,
          padding: '4px',
        }),
        placeholder: (styles) => ({
          ...styles,
          color: 'var(--text-secondary)',
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
          backgroundColor: 'var(--bg-layer-3)',
          border: '1px solid var(--stroke-primary)',
          boxShadow: 'none',
          transition: 'all 0',
          ':hover': {
            border: '1px solid var(--stroke-accent-primary)',
          },
        }),
      }}
      noOptionsMessage={() => t('No options')}
    />
  );
}
