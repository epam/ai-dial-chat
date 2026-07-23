import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import Select, { Props as SelectProps, components } from 'react-select';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { DropdownSelectorOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Tooltip } from './Tooltip';

import { DialButton } from '@epam/ai-dial-ui-kit';

type Props = SelectProps<DropdownSelectorOption, true> & {
  tooltip?: string;
  closeMenuOnSelect?: boolean;
};

export function DropdownSelector({
  tooltip,
  closeMenuOnSelect = false,
  ...selectProps
}: Props) {
  const { t } = useTranslation(Translation.Common);

  const [isMenuOpen, setIsMenuOpen] = selectProps.menuIsOpen
    ? [selectProps.menuIsOpen, selectProps.onMenuOpen]
    : useState(false);
  const onMenuOpen = () => {
    if (!isMenuOpen) {
      selectProps.onMenuOpen?.();
    }
    setIsMenuOpen?.(!isMenuOpen);
  };
  return (
    <Tooltip
      triggerClassName={classNames(
        'w-full',
        selectProps.isDisabled && 'cursor-not-allowed',
      )}
      tooltip={tooltip}
    >
      <Select
        {...selectProps}
        closeMenuOnSelect={closeMenuOnSelect}
        name="colors"
        onMenuOpen={onMenuOpen}
        onMenuClose={() => {
          selectProps.onMenuClose?.();
          setIsMenuOpen?.(false);
        }}
        menuPortalTarget={document.body}
        components={{
          ClearIndicator: (props) => (
            <DialButton
              className="group p-2"
              onClick={() => props.clearValue()}
              onTouchEnd={() => props.clearValue()}
              iconBefore={
                <IconX
                  className="shrink-0 text-secondary group-hover:text-accent-primary"
                  data-qa="clear-dropdown-selection"
                  size={18}
                />
              }
            />
          ),
          MultiValueRemove: (props) => (
            <components.MultiValueRemove
              {...props}
              innerProps={{
                ...props.innerProps,
                style: {
                  ...props.innerProps.style,
                  fontSize: '12px',
                  backgroundColor: 'transparent',
                },
                className: 'group',
              }}
            >
              <IconX
                className="cursor-pointer text-secondary group-hover:text-accent-primary"
                size={DEFAULT_ICON_SIZES.SMALL}
              />
            </components.MultiValueRemove>
          ),
          IndicatorsContainer: () =>
            isMenuOpen ? (
              <IconChevronUp size={18} className="text-primary" />
            ) : (
              <IconChevronDown size={18} className="text-primary" />
            ),
        }}
        styles={{
          indicatorsContainer: (styles) => ({
            ...styles,
            cursor: 'default',
            alignSelf: 'center',
          }),
          input: (styles) => ({
            ...styles,
            height: '21px',
            fontSize: '12px',
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
            WebkitTapHighlightColor: state.data.backgroundColor,
            backgroundColor: '',
            cursor: 'pointer',
            ':hover': {
              backgroundColor:
                state.data.backgroundColor ?? 'var(--bg-accent-primary-alpha)',
            },
            ':active': {
              backgroundColor:
                state.data.backgroundColor ?? 'var(--bg-accent-primary-alpha)',
            },
            color: 'var(--text-primary)',
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
          indicatorSeparator: (styles) => ({
            ...styles,
            visibility: 'hidden',
            backgroundColor: 'var(--text-secondary)',
          }),
          multiValue: (styles, state) => ({
            ...styles,
            height: '30px',
            backgroundColor: state.data.backgroundColor,
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
            fontSize: '12px',
            color: 'var(--text-primary)',
          }),
          valueContainer: (styles) => ({
            ...styles,
            padding: '4px',
            gap: '2px',
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
            paddingLeft: state.hasValue ? '8px' : '8px',
            display: 'flex',
            cursor: 'text',
            backgroundColor: 'bg-transparent',
            border: '1px solid var(--stroke-primary)',
            boxShadow: 'none',
            transition: 'all 0',
            fontSize: '12px !important',
            ':hover': {
              border: '1px solid var(--stroke-accent-primary)',
            },
          }),
          singleValue: (styles) => ({
            ...styles,
            fontSize: '12px',
            color: 'var(--text-primary)',
          }),
        }}
        noOptionsMessage={() => t(CommonI18nKeys.NoOptions)}
      />
    </Tooltip>
  );
}
