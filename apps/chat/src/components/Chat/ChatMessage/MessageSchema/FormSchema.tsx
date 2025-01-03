import { memo, useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { getFormButtonType } from '@/src/utils/app/form-schema';

import { FormButtonType } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import {
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
}

export const ButtonsProperty = ({
  options,
  onClick,
  formValue,
  showSelected,
  disabled,
}: ButtonsPropertyProps) => {
  const { t } = useTranslation(Translation.Chat);

  const [confirmation, setConfirmation] = useState<FormSchemaButtonOption>();

  const handleClick = useCallback(
    (option: FormSchemaButtonOption) => {
      if (option['dial:widgetOptions']?.confirmationMessage && !confirmation) {
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
      <div className="flex flex-wrap items-center gap-2">
        {options?.map((option) => (
          <button
            key={option.const}
            onClick={() => handleClick(option)}
            className={classNames('chat-button', {
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
          confirmation?.['dial:widgetOptions']?.confirmationMessage ?? '',
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
}

const PropertyRenderer = ({
  property,
  name,
  onChange,
  formValue,
  showSelected,
  disabled,
}: PropertyRendererProps) => {
  const handleClick = useCallback(
    (value: number, type: FormButtonType) => {
      onChange(name, value, type === FormButtonType.Submit);
    },
    [name, onChange],
  );

  return (
    <div className="flex flex-col gap-3">
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
}

export const FormSchema = memo(function FormSchema({
  schema,
  formValue,
  onChange,
  showSelected,
  disabled,
}: FormSchemaProps) {
  return (
    <div className="flex flex-col gap-2">
      {Object.entries(schema.properties).map(([name, property]) => (
        <PropertyRenderer
          property={property}
          name={name}
          onChange={onChange}
          key={name}
          disabled={disabled}
          showSelected={showSelected}
          formValue={formValue}
        />
      ))}
    </div>
  );
});
