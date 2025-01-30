import { memo, useCallback, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getFormButtonType } from '@/src/utils/app/form-schema';

import { FormButtonType } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import {
  DialSchemaProperties,
  FormSchemaButtonOption,
  FormSchemaProperty,
  FormSchemaPropertyType,
  MessageFormSchema,
  MessageFormValue,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

interface ButtonsPropertyProps {
  options?: FormSchemaButtonOption[];
  formValue?: MessageFormValue;
  onClick: (value: number, type: FormButtonType) => void;
  showSelected?: boolean;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

export const ButtonsProperty = ({
  options,
  onClick,
  formValue,
  showSelected,
  disabled,
  className,
  buttonClassName,
}: ButtonsPropertyProps) => {
  const { t } = useTranslation(Translation.Chat);

  const [confirmation, setConfirmation] = useState<FormSchemaButtonOption>();

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

  return (
    <>
      <div
        className={classNames('flex flex-wrap items-center gap-2', className)}
      >
        {options?.map((option) => (
          <button
            data-no-context-menu
            key={option.const}
            onClick={() => handleClick(option)}
            className={classNames('chat-button', buttonClassName, {
              'button-accent-primary':
                showSelected &&
                Object.values(formValue ?? {}).includes(option.const),
            })}
            disabled={disabled}
          >
            {option.title}
          </button>
        ))}
      </div>

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
        <p className="text-base text-primary">{property.description}</p>
      )}

      {property.type === FormSchemaPropertyType.number && (
        <ButtonsProperty
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
