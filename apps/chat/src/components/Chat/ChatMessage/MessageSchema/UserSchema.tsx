import { memo, useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getConfigurationSchema,
  getMessageSchema,
  getVisibleFormValues,
  isFormSchemaValid,
} from '@/src/utils/app/form-schema';

import { FormButtonType } from '@/src/types/chat';
import { FormSchemaPropertyType } from '@/src/types/form-schema';
import { Translation } from '@/src/types/translation';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { Checkbox } from '@/src/components/Common/Forms/Checkbox';
import { EntityMarkdownDescription } from '@/src/components/Common/MarkdownDescription';

import {
  DialSchemaProperties,
  Message,
  MessageFormSchema,
  MessageFormValue,
  MessageFormValueType,
} from '@epam/ai-dial-shared';
import { DialButton, DialEllipsisTooltip } from '@epam/ai-dial-ui-kit';

const emptyHandler = () => undefined;

interface UserSchemaProps {
  messageIndex: number;
  allMessages: Message[];
  isEditing: boolean;
  setInputValue?: (v: string) => void;
  formValue?: MessageFormValue;
  setFormValue?: (value: MessageFormValue) => void;
  onSubmit?: (formValue?: MessageFormValue, content?: string) => void;
  disabled?: boolean;
  schema?: MessageFormSchema;
}

const UserSchemaView = memo(function UserSchemaView({
  isEditing,
  setInputValue,
  formValue,
  setFormValue,
  onSubmit,
  disabled,
  schema,
}: UserSchemaProps) {
  const { t } = useTranslation(Translation.Chat);

  const handleChange = useCallback(
    (property: string, value: MessageFormValueType, submit?: boolean) => {
      if (schema && formValue) {
        const populateText = schema.properties[property]?.oneOf?.find(
          (option) => option.const === value,
        )?.[DialSchemaProperties.DialWidgetOptions]?.populateText;

        setFormValue?.({ ...formValue, [property]: value });

        if (populateText) setInputValue?.(populateText);
        if (submit)
          onSubmit?.({ ...formValue, [property]: value }, populateText);
      }
    },
    [formValue, onSubmit, schema, setFormValue, setInputValue],
  );

  const schemaPropertiesWithUserResponse = useMemo(
    () =>
      getVisibleFormValues(schema, formValue).filter(
        (property) =>
          property.type === FormSchemaPropertyType.Checkbox ||
          property.options.some(
            (option) => option.buttonType === FormButtonType.Submit,
          ),
      ),
    [formValue, schema],
  );

  if (!schema && formValue)
    return <ErrorMessage error={t(ChatI18nKeys.FormSchemaMissing)} />;

  if (!formValue || !schema) return null;

  if (isEditing)
    return (
      <FormSchema
        schema={schema}
        onChange={handleChange}
        formValue={formValue}
        showSelected
        disabled={disabled}
      />
    );

  return schemaPropertiesWithUserResponse.length ? (
    <div className="flex flex-col gap-6">
      {schemaPropertiesWithUserResponse.map((row) => {
        const buttonDescriptions =
          row.type === FormSchemaPropertyType.Button
            ? row.options.filter(
                (option) =>
                  option.showDescriptionInUserMessage && option.description,
              )
            : [];

        return (
          <div key={row.property}>
            {!!row.description && (
              <EntityMarkdownDescription className="mb-3 text-base text-primary">
                {row.description}
              </EntityMarkdownDescription>
            )}

            {row.type === FormSchemaPropertyType.Button && (
              <>
                <div className="flex flex-wrap gap-2">
                  {row.options.map((option) => (
                    <DialButton
                      key={String(option.value)}
                      className={classNames(
                        'chat-button truncate',
                        option.selected && 'button-accent-primary',
                      )}
                      disabled
                      label={<DialEllipsisTooltip text={option.label} />}
                    />
                  ))}
                </div>
                {buttonDescriptions.length > 0 && (
                  <div className="mt-3 flex flex-col gap-3">
                    {buttonDescriptions.map((option) => (
                      <EntityMarkdownDescription
                        key={String(option.value)}
                        className="text-base text-primary"
                      >
                        {option.description!}
                      </EntityMarkdownDescription>
                    ))}
                  </div>
                )}
              </>
            )}

            {row.type === FormSchemaPropertyType.Checkbox && (
              <div className="flex flex-wrap gap-4">
                {row.options?.map((option) => (
                  <Checkbox
                    key={String(option.value)}
                    checked={option.selected}
                    caption={option.label}
                    disabled={!option.selected}
                    readonly={option.selected}
                    onClick={emptyHandler}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : null;
});

export const UserSchema = memo(function UserSchema(props: UserSchemaProps) {
  const { t } = useTranslation(Translation.Chat);

  const schema = useMemo(() => {
    if (props.messageIndex === 0)
      return getConfigurationSchema(props.allMessages[0]);
    return getMessageSchema(props.allMessages[props.messageIndex - 1]);
  }, [props.allMessages, props.messageIndex]);

  if (schema && !isFormSchemaValid(schema))
    return (
      <div className="mt-2">
        <ErrorMessage error={t(ChatI18nKeys.FormSchemaInvalid)} />
      </div>
    );

  return <UserSchemaView {...props} schema={schema} />;
});
