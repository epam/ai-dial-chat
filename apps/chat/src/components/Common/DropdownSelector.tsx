import { IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import Select, { Props as SelectProps, components } from 'react-select';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getSelectButtonProps } from '@/src/utils/app/select';

import { DropdownSelectorOption } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { CommonI18nKeys } from '@/src/constants/i18n';
import { DEFAULT_ICON_SIZES } from '@/src/constants/icons';

import { Tooltip } from './Tooltip';

import { DialGhostIconButton, ElementSize } from '@epam/ai-dial-ui-kit';

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
        menuPortalTarget={document.body}
        components={{
          ClearIndicator: (props) => (
            <DialGhostIconButton
              size={ElementSize.Small}
              data-qa="clear-dropdown-selection"
              onClick={() => props.clearValue()}
              onTouchEnd={() => props.clearValue()}
              icon={
                <IconX className="shrink-0" size={DEFAULT_ICON_SIZES.SMALL} />
              }
            />
          ),
          MultiValueRemove: (props) => (
            <DialGhostIconButton
              size={ElementSize.Small}
              {...getSelectButtonProps(props.innerProps)}
              data-qa={`unselect-item-${props.data.value}`}
              icon={<IconX size={DEFAULT_ICON_SIZES.SMALL} />}
            />
          ),
          DropdownIndicator: (props) => (
            <components.DropdownIndicator {...props}>
              {props.selectProps.menuIsOpen ? (
                <IconChevronUp
                  size={DEFAULT_ICON_SIZES.SMALL}
                  className="shrink-0 text-primary"
                />
              ) : (
                <IconChevronDown
                  size={DEFAULT_ICON_SIZES.SMALL}
                  className="shrink-0 text-primary"
                />
              )}
            </components.DropdownIndicator>
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
            fontSize: '14px',
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
          dropdownIndicator: (styles) => ({
            ...styles,
            color: 'var(--text-primary)',
            cursor: 'pointer',
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
            fontSize: '14px',
            color: 'var(--text-primary)',
          }),
        }}
        noOptionsMessage={() => t(CommonI18nKeys.NoOptions)}
      />
    </Tooltip>
  );
}
