import { memo, useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { getFormButtonType } from '@/src/utils/app/form-schema';

import { FormButtonType } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';

import {
  FormSchemaButtonOption,
  Message,
  MessageFormSchema,
  MessageFormValue,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

interface UserSchemaProps {
  messageIndex: number;
  allMessages: Message[];
  isEditing: boolean;
  setInputValue?: (v: string) => void;
  formValue?: MessageFormValue;
  setFormValue?: (value: MessageFormValue) => void;
  onSubmit?: (formValue?: MessageFormValue, content?: string) => void;
  disabled?: boolean;
}

export const UserSchema = memo(function UserSchema({
  messageIndex,
  allMessages,
  isEditing,
  setInputValue,
  formValue,
  setFormValue,
  onSubmit,
  disabled,
}: UserSchemaProps) {
  const { t } = useTranslation(Translation.Chat);

  const schema = allMessages[messageIndex - 1]?.custom_content?.form_schema;

  const handleChange = useCallback(
    (property: string, value: MessageFormValueType, submit?: boolean) => {
      if (schema && formValue) {
        const populateText = schema.properties[property]?.oneOf?.find(
          (option) => option.const === value,
        )?.['dial:widgetOptions']?.populateText;

        setFormValue?.({ ...formValue, [property]: value });

        if (populateText) setInputValue?.(populateText);
        if (submit)
          onSubmit?.({ ...formValue, [property]: value }, populateText);
      }
    },
    [formValue, onSubmit, schema, setFormValue, setInputValue],
  );

  const clickedButtons = useMemo(() => {
    if (!formValue || !schema) return [];

    return Object.entries(formValue)
      .map(([key, value]) =>
        schema.properties[key].oneOf?.find((option) => option.const === value),
      )
      .filter(
        (option) =>
          option && getFormButtonType(option) === FormButtonType.Submit,
      ) as FormSchemaButtonOption[];
  }, [formValue, schema]);

  const filteredSchema = useMemo(() => {
    if (!schema) return null;

    const newSchema: MessageFormSchema = {
      ...schema,
      properties: Object.entries(schema.properties).reduce(
        (acc, [key, property]) => {
          const actionButtons =
            property.oneOf?.filter(
              (o) => getFormButtonType(o) === FormButtonType.Submit,
            ) ?? [];
          if (actionButtons.length) {
            return {
              ...acc,
              [key]: { ...property, oneOf: actionButtons, description: '' },
            };
          }
          return acc;
        },
        {},
      ),
    };

    return newSchema;
  }, [schema]);

  if (!schema && formValue)
    return <ErrorMessage error={t('Form schema is missing') ?? ''} />;

  if (!formValue || !filteredSchema) return null;

  if (isEditing)
    return (
      <div className="border-b border-primary py-2">
        <FormSchema
          schema={filteredSchema}
          onChange={handleChange}
          formValue={formValue}
          showSelected
          disabled={disabled}
        />
      </div>
    );

  return clickedButtons.length ? (
    <div className="flex flex-wrap items-center gap-2">
      {clickedButtons.map((option) => (
        <button key={option.const} className="button button-secondary" disabled>
          {option.title}
        </button>
      ))}
    </div>
  ) : null;
});
