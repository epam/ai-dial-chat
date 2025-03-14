import { IconDotsVertical } from '@tabler/icons-react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import classNames from 'classnames';

import { useScreenState } from '@/src/hooks/useScreenState';
import { useTranslation } from '@/src/hooks/useTranslation';

import { getFormButtonType } from '@/src/utils/app/form-schema';

import { FormButtonType } from '@/src/types/chat';
import { ScreenState } from '@/src/types/common';
import { Translation } from '@/src/types/translation';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import { ButtonsSchemaModal } from './ButtonsSchemaModal';
import { SchemaButton } from './SchemaButton';

import {
  DialSchemaProperties,
  FormSchemaButtonOption,
  FormSchemaProperty,
  FormSchemaPropertyWidget,
  MessageFormSchema,
  MessageFormValue,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

interface HiddenButtonsPropertyProps {
  options: FormSchemaButtonOption[];
  hiddenOptions: FormSchemaButtonOption[];
  className?: string;
  buttonClassName?: string;
  onSetVisibleOptions: (options: FormSchemaButtonOption[]) => void;
  onSetHiddenOptions: (options: FormSchemaButtonOption[]) => void;
}

const buttonsWrapperClassName = 'flex flex-wrap items-center gap-2';
const MAX_LINES = 3;

const HiddenButtonsProperty = forwardRef<
  HTMLDivElement,
  HiddenButtonsPropertyProps
>(
  (
    {
      options,
      hiddenOptions,
      className,
      buttonClassName,
      onSetVisibleOptions,
      onSetHiddenOptions,
    },
    containerRef,
  ) => {
    const hiddenContainerRef = useRef<HTMLDivElement>(null);
    const dotsButtonRef = useRef<HTMLButtonElement>(null);

    const determineVisibility = useCallback(() => {
      if (
        !hiddenContainerRef.current ||
        !(containerRef as React.RefObject<HTMLDivElement>).current
      )
        return;

      const hiddenButtons = Array.from(
        hiddenContainerRef.current.children,
      ) as HTMLElement[];
      if (hiddenButtons.length === 0) {
        onSetVisibleOptions(options);
        onSetHiddenOptions([]);
        return;
      }

      const visible: FormSchemaButtonOption[] = [];
      const hidden: FormSchemaButtonOption[] = [];
      let currentLine = 1;
      let lastOffsetTop = hiddenButtons[0].offsetTop;

      hiddenButtons.forEach((btn, index) => {
        const offsetTop = btn.offsetTop;
        if (offsetTop > lastOffsetTop) {
          currentLine += 1;
          lastOffsetTop = offsetTop;
        }

        if (currentLine <= MAX_LINES) {
          if (btn !== dotsButtonRef.current) {
            visible.push(options[dotsButtonRef.current ? index - 1 : index]);
          }
        } else {
          if (btn !== dotsButtonRef.current) {
            hidden.push(options[dotsButtonRef.current ? index - 1 : index]);
          }
        }
      });

      onSetVisibleOptions(visible);
      onSetHiddenOptions(hidden);
    }, [containerRef, onSetHiddenOptions, onSetVisibleOptions, options]);

    useEffect(() => {
      const handleResize = () => {
        determineVisibility();
      };

      const resizeObserver = new ResizeObserver(handleResize);

      if (hiddenContainerRef.current) {
        resizeObserver.observe(hiddenContainerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }, [determineVisibility, options]);

    return (
      <div
        ref={hiddenContainerRef}
        className={classNames(
          'invisible absolute',
          buttonsWrapperClassName,
          className,
        )}
      >
        {hiddenOptions.length > 0 && (
          <button ref={dotsButtonRef} className="chat-button">
            <IconDotsVertical size={18} />
          </button>
        )}
        {options.map((option) => (
          <button
            key={option.const}
            className={classNames('chat-button', buttonClassName)}
            disabled
          >
            {option.title}
          </button>
        ))}
      </div>
    );
  },
);
HiddenButtonsProperty.displayName = 'HiddenButtonsProperty';

interface ButtonsPropertyProps {
  isChatStarters: boolean;
  options?: FormSchemaButtonOption[];
  formValue?: MessageFormValue;
  onClick: (value: number, type: FormButtonType) => void;
  showSelected?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

export const ButtonsProperty = ({
  isChatStarters,
  options = [],
  onClick,
  formValue,
  showSelected,
  disabled,
  className,
  buttonClassName,
}: ButtonsPropertyProps) => {
  const { t } = useTranslation(Translation.Chat);

  const [confirmation, setConfirmation] = useState<FormSchemaButtonOption>();
  const [visibleOptions, setVisibleOptions] =
    useState<FormSchemaButtonOption[]>(options);
  const [hiddenOptions, setHiddenOptions] = useState<FormSchemaButtonOption[]>(
    [],
  );
  const [hiddenOptionsModal, setHiddenOptionsModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const screenState = useScreenState();

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
      <div
        className={classNames(buttonsWrapperClassName, className)}
        ref={containerRef}
      >
        {visibleOptions.map((option) => (
          <SchemaButton
            key={option.title}
            option={option}
            showSelected={!!showSelected}
            disabled={!!disabled}
            formValue={formValue}
            className={buttonClassName}
            onClick={handleClick}
          />
        ))}

        {hiddenOptions.length > 0 && (
          <button
            onClick={() => setHiddenOptionsModal(true)}
            className="chat-button"
          >
            <IconDotsVertical size={18} />
          </button>
        )}
      </div>

      {screenState === ScreenState.SM && isChatStarters && (
        <HiddenButtonsProperty
          ref={containerRef}
          onSetVisibleOptions={setVisibleOptions}
          onSetHiddenOptions={setHiddenOptions}
          hiddenOptions={hiddenOptions}
          options={options}
          className={className}
          buttonClassName={buttonClassName}
        />
      )}

      {hiddenOptionsModal && (
        <ButtonsSchemaModal
          options={hiddenOptions}
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
        heading={t(
          confirmation?.[DialSchemaProperties.DialWidgetOptions]
            ?.confirmationMessage ?? '',
        )}
        confirmLabel={t('Yes')}
        cancelLabel={t('No')}
        onClose={handleCloseConfirmation}
      />
    </>
  );
};

interface PropertyRendererProps {
  property: FormSchemaProperty;
  name: string;
  isChatStarters: boolean;
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
  name,
  isChatStarters,
  onChange,
  formValue,
  showSelected,
  disabled,
  className,

  buttonsWrapperClassName,
  buttonClassName,
}: PropertyRendererProps) => {
  const handleClick = useCallback(
    (value: number, type: FormButtonType) => {
      onChange(name, value, type === FormButtonType.Submit);
    },
    [name, onChange],
  );

  return (
    <div className={classNames('flex flex-col gap-3', className)}>
      {property.description && (
        <p className="whitespace-pre-line text-base text-primary">
          {property.description}
        </p>
      )}

      {property[DialSchemaProperties.DialWidget] ===
        FormSchemaPropertyWidget.buttons && (
        <ButtonsProperty
          isChatStarters={isChatStarters}
          options={property.oneOf}
          onClick={handleClick}
          disabled={disabled}
          showSelected={showSelected}
          formValue={formValue}
          className={buttonsWrapperClassName}
          buttonClassName={buttonClassName}
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
  isChatStarters?: boolean;
  showSelected?: boolean;
  disabled?: boolean;
  formValue?: MessageFormValue;

  wrapperClassName?: string;
  propertyWrapperClassName?: string;
  buttonsWrapperClassName?: string;
  buttonClassName?: string;
}

export const FormSchema = memo(function FormSchema({
  schema,
  formValue,
  onChange,
  isChatStarters,
  showSelected,
  disabled,
  wrapperClassName,
  propertyWrapperClassName,
  buttonsWrapperClassName,
  buttonClassName,
}: FormSchemaProps) {
  return (
    <div className={classNames('flex flex-col gap-2', wrapperClassName)}>
      {Object.entries(schema.properties).map(([name, property]) => (
        <PropertyRenderer
          isChatStarters={!!isChatStarters}
          property={property}
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
