import { IconDotsVertical } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import classNames from 'classnames';

import { useResizeObserver } from '@/src/hooks/useResizeObserver';
import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getFormButtonType,
  getFormCheckboxDefinitionOptions,
  getFormSchemaPropertyType,
  getSortedFormSchemaProperties,
} from '@/src/utils/app/form-schema';

import { FormButtonType } from '@/src/types/chat';
import { SelectOption } from '@/src/types/common';
import { FormSchemaPropertyType } from '@/src/types/form-schema';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ConversationsSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';
import { withErrorBoundary } from '@/src/components/Common/ErrorBoundary';
import { Checkbox } from '@/src/components/Common/Forms/Checkbox';

import { ButtonsSchemaModal } from './ButtonsSchemaModal';
import { SchemaButton } from './SchemaButton';

import {
  DialSchemaProperties,
  FormSchemaButtonOption,
  FormSchemaProperty,
  MessageFormSchema,
  MessageFormValue,
  MessageFormValueType,
} from '@epam/ai-dial-shared';
import { DialButton } from '@epam/ai-dial-ui-kit';
import intersection from 'lodash-es/intersection';

interface HiddenButtonsPropertyProps {
  options: FormSchemaButtonOption[];
  className?: string;
  buttonClassName?: string;
  onSetVisibleOptions: (options: FormSchemaButtonOption[]) => void;
  onSetHiddenOptions: (options: FormSchemaButtonOption[]) => void;
  onCloseModal: () => void;
}

interface HTMLSchemaButtonType {
  option: FormSchemaButtonOption;
  line: number;
  btn: HTMLElement;
}

const buttonsWrapperClassName = 'flex flex-wrap items-center gap-2';
const MAX_LINES = 3;

const getContainerStyles = (element: HTMLElement) => {
  const style = window.getComputedStyle(element);

  return {
    gap: parseFloat(style.gap),
    paddingX: parseFloat(style.paddingRight) + parseFloat(style.paddingLeft),
  };
};

const HiddenButtonsProperty = ({
  options,
  className,
  buttonClassName,
  onSetVisibleOptions,
  onSetHiddenOptions,
  onCloseModal,
}: HiddenButtonsPropertyProps) => {
  const hiddenContainerRef = useRef<HTMLDivElement>(null);
  const dotsButtonRef = useRef<HTMLButtonElement>(null);

  const determineVisibility = useCallback(() => {
    if (!hiddenContainerRef.current) return;

    const hiddenButtons = Array.from(
      hiddenContainerRef.current.children,
    ) as HTMLElement[];

    if (hiddenButtons.length === 0) {
      onSetVisibleOptions(options);
      onSetHiddenOptions([]);
      return;
    }

    const visible: HTMLSchemaButtonType[] = [];
    const hidden: HTMLSchemaButtonType[] = [];
    let currentLine = 1;
    let lastOffsetTop = hiddenButtons[0].offsetTop;
    let currentOptionIdx = 0;

    hiddenButtons.forEach((btn) => {
      const offsetTop = btn.offsetTop;
      if (offsetTop > lastOffsetTop) {
        currentLine += 1;
        lastOffsetTop = offsetTop;
      }

      if (btn === dotsButtonRef.current) {
        return;
      }

      const option = options[currentOptionIdx];

      if (currentLine <= MAX_LINES) {
        visible.push({ option, line: currentLine, btn });
      } else {
        hidden.push({ option, line: currentLine, btn });
      }

      currentOptionIdx++;
    });

    const maxLineItems = visible.filter((item) => item.line === MAX_LINES);
    if (maxLineItems.length) {
      const { gap, paddingX } = getContainerStyles(hiddenContainerRef.current);
      const allBtnsWidth = maxLineItems.reduce(
        (acc, item) => (item.btn.offsetWidth ?? 0) + gap + acc,
        0,
      );
      const containerContentWidth =
        hiddenContainerRef.current.clientWidth - paddingX;
      const buttonsContentWidth =
        allBtnsWidth + (dotsButtonRef.current?.clientWidth ?? 0) + gap;

      if (buttonsContentWidth >= containerContentWidth) {
        const lastItem = visible.pop();

        if (lastItem) {
          hidden.unshift(lastItem);
        }
      }
    }

    const isSomethingVisibleOnLastLine = visible.some(
      ({ line }) => line === MAX_LINES,
    );

    if (hidden.length === 1 && !isSomethingVisibleOnLastLine) {
      const hiddenOption = hidden.pop();

      if (hiddenOption) {
        visible.push(hiddenOption);
      }
    }

    if (!hidden.length) {
      onCloseModal();
    }

    onSetVisibleOptions(visible.map((item) => item.option));
    onSetHiddenOptions(hidden.map((item) => item.option));
  }, [onCloseModal, onSetHiddenOptions, onSetVisibleOptions, options]);

  useResizeObserver(hiddenContainerRef.current, determineVisibility);

  useEffect(() => {
    return () => {
      onSetHiddenOptions([]);
      onSetVisibleOptions(options);
    };
  }, [onSetHiddenOptions, onSetVisibleOptions, options]);

  return (
    <div
      ref={hiddenContainerRef}
      className={classNames(
        'invisible max-h-0',
        buttonsWrapperClassName,
        className,
      )}
    >
      {options.map((option) => (
        <DialButton
          key={`${option.const}`}
          className={classNames('chat-button', buttonClassName)}
          disabled
          label={option.title}
        />
      ))}
      <DialButton
        ref={dotsButtonRef}
        className="chat-button"
        iconBefore={<IconDotsVertical size={18} />}
      />
    </div>
  );
};

interface ButtonsPropertyProps {
  options?: FormSchemaButtonOption[];
  formValue?: MessageFormValue;
  onClick: (value: MessageFormValueType, type: FormButtonType) => void;
  showSelected?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

const ButtonsProperty = ({
  options = [],
  onClick,
  formValue,
  showSelected,
  disabled,
  className,
  buttonClassName,
}: ButtonsPropertyProps) => {
  const { t } = useTranslation(Translation.Chat);

  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );

  const [confirmation, setConfirmation] = useState<FormSchemaButtonOption>();
  const [visibleOptions, setVisibleOptions] =
    useState<FormSchemaButtonOption[]>(options);
  const [hiddenOptions, setHiddenOptions] = useState<FormSchemaButtonOption[]>(
    [],
  );
  const [hiddenOptionsModal, setHiddenOptionsModal] = useState(false);

  const handleClick = useCallback(
    (option: FormSchemaButtonOption) => {
      if (
        option[DialSchemaProperties.DialWidgetOptions]?.confirmationMessage &&
        !confirmation
      ) {
        setConfirmation(option);
        return;
      }

      onClick(option.const, getFormButtonType(option));
      setConfirmation(undefined);
      setHiddenOptionsModal(false);
    },
    [confirmation, onClick],
  );

  const handleCloseConfirmation = useCallback(
    (result: boolean) => {
      if (result && confirmation) handleClick(confirmation);
      else setConfirmation(undefined);
    },
    [confirmation, handleClick],
  );

  const handleCloseButtonsModal = useCallback(() => {
    setHiddenOptionsModal(false);
  }, []);

  return (
    <>
      <div className={classNames(buttonsWrapperClassName, className)}>
        {visibleOptions.map((option) => (
          <SchemaButton
            key={`${option.const}`}
            option={option}
            showSelected={!!showSelected}
            disabled={!!disabled}
            formValue={formValue}
            className={buttonClassName}
            onClick={handleClick}
          />
        ))}

        {hiddenOptions.length > 0 && (
          <DialButton
            onClick={() => setHiddenOptionsModal(true)}
            className={classNames(
              'chat-button',
              showSelected &&
                intersection(
                  Object.values(formValue ?? {}),
                  hiddenOptions.map((option) => option.const),
                ).length &&
                'button-accent-primary',
            )}
            iconBefore={<IconDotsVertical size={18} />}
          />
        )}
      </div>

      {!selectedConversations[0]?.messages.length && (
        <HiddenButtonsProperty
          options={options}
          className={className}
          buttonClassName={buttonClassName}
          onSetVisibleOptions={setVisibleOptions}
          onSetHiddenOptions={setHiddenOptions}
          onCloseModal={handleCloseButtonsModal}
        />
      )}

      {hiddenOptionsModal && (
        <ButtonsSchemaModal
          options={options}
          disabled={!!disabled}
          showSelected={!!showSelected}
          formValue={formValue}
          buttonClassName={buttonClassName}
          containerClassName={classNames(buttonsWrapperClassName, className)}
          onButtonClick={handleClick}
          onClose={handleCloseButtonsModal}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmation}
        showHeadingTooltip
        heading={t(
          confirmation?.[DialSchemaProperties.DialWidgetOptions]
            ?.confirmationMessage ?? '',
        )}
        confirmLabel={t(ChatI18nKeys.Yes)}
        cancelLabel={t(ChatI18nKeys.No)}
        onClose={handleCloseConfirmation}
      />
    </>
  );
};

interface CheckboxPropertyProps {
  options: SelectOption<string, string>[];
  formValue?: MessageFormValue;
  propertyKey: string;
  onClick: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

const CheckboxProperty = ({
  options,
  formValue,
  propertyKey,
  onClick,
  className,
  disabled,
}: CheckboxPropertyProps) => {
  const isPlayback = useAppSelector(
    ConversationsSelectors.selectIsPlaybackSelectedConversations,
  );

  return (
    <div className={classNames('flex flex-wrap gap-4', className)}>
      {options.map(({ value, label }) => (
        <Checkbox
          key={value}
          checked={
            Array.isArray(formValue?.[propertyKey]) &&
            formValue?.[propertyKey]?.includes(value)
          }
          onChange={() => onClick(value)}
          caption={label}
          disabled={disabled}
          readonly={isPlayback}
        />
      ))}
    </div>
  );
};

interface PropertyRendererProps {
  property: FormSchemaProperty;
  schema: MessageFormSchema;
  name: string;
  onChange: (
    name: string,
    value: MessageFormValueType,
    submit?: boolean,
  ) => void;
  formValue?: MessageFormValue;
  showSelected?: boolean;
  disabled?: boolean;
  className?: string;

  buttonsWrapperClassName?: string;
  buttonClassName?: string;
}

const PropertyRenderer = ({
  property,
  schema,
  name,
  onChange,
  formValue,
  showSelected,
  disabled,
  className,

  buttonsWrapperClassName,
  buttonClassName,
}: PropertyRendererProps) => {
  const propertyType = getFormSchemaPropertyType(schema, name);

  const handleButtonClick = useCallback(
    (value: MessageFormValueType, type: FormButtonType) => {
      onChange(name, value, type === FormButtonType.Submit);
    },
    [name, onChange],
  );

  const handleCheckboxClick = useCallback(
    (value: string) => {
      const currentValue = Array.isArray(formValue?.[name])
        ? formValue?.[name]
        : [];
      const newValue = currentValue.includes(value)
        ? currentValue.filter((v) => v !== value)
        : [...currentValue, value];

      onChange(name, newValue, false);
    },
    [formValue, name, onChange],
  );

  const checkboxDefinitions = useMemo(() => {
    return getFormCheckboxDefinitionOptions(schema, name);
  }, [name, schema]);

  if (
    !property.description &&
    propertyType !== FormSchemaPropertyType.Button &&
    propertyType !== FormSchemaPropertyType.Checkbox
  )
    return null;

  return (
    <div
      className={classNames('flex flex-col gap-3 overflow-hidden', className)}
    >
      <p className="whitespace-pre-line text-base text-primary">
        {property.description}
      </p>

      {propertyType === FormSchemaPropertyType.Button && (
        <ButtonsProperty
          options={property.oneOf}
          onClick={handleButtonClick}
          disabled={disabled}
          showSelected={showSelected}
          formValue={formValue}
          className={buttonsWrapperClassName}
          buttonClassName={buttonClassName}
        />
      )}

      {propertyType === FormSchemaPropertyType.Checkbox && (
        <CheckboxProperty
          options={checkboxDefinitions}
          onClick={handleCheckboxClick}
          disabled={disabled}
          formValue={formValue}
          propertyKey={name}
        />
      )}
    </div>
  );
};

interface FormSchemaProps {
  schema: MessageFormSchema;
  onChange: (
    name: string,
    value: MessageFormValueType,
    submit?: boolean,
  ) => void;
  showSelected?: boolean;
  disabled?: boolean;
  formValue?: MessageFormValue;

  wrapperClassName?: string;
  propertyWrapperClassName?: string;
  buttonsWrapperClassName?: string;
  buttonClassName?: string;
}

const FormSchemaMemo = memo(function FormSchema({
  schema,
  formValue,
  onChange,
  showSelected,
  disabled,
  wrapperClassName,
  propertyWrapperClassName,
  buttonsWrapperClassName,
  buttonClassName,
}: FormSchemaProps) {
  const sortedProperties = useMemo(
    () => getSortedFormSchemaProperties(schema),
    [schema],
  );

  return (
    <div className={classNames('flex flex-col gap-6', wrapperClassName)}>
      {sortedProperties.map(([name, property]) => (
        <PropertyRenderer
          property={property}
          schema={schema}
          name={name}
          onChange={onChange}
          key={name}
          disabled={disabled}
          showSelected={showSelected}
          formValue={formValue}
          buttonsWrapperClassName={buttonsWrapperClassName}
          buttonClassName={buttonClassName}
          className={propertyWrapperClassName}
        />
      ))}
    </div>
  );
});

export const FormSchema = withErrorBoundary(FormSchemaMemo);
