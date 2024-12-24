import { memo, useMemo } from 'react';

import { getFormButtonType } from '@/src/utils/app/form-schema';

import { FormButtonType } from '@/src/types/chat';

// import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import {
  DialWidgets,
  FormSchemaPropertyValue,
  Message,
} from '@epam/ai-dial-shared';

const isFormActionReply = (message: Message) => {
  return !!message.custom_content?.form_value;
};

const getFormActionReplyWidgets = (
  message: Message,
  index: number,
  allMessages: Message[],
) => {
  const schema = allMessages[index - 1]?.custom_content?.form_schema;

  if (!isFormActionReply(message) || !schema) return [];

  const formValue = message.custom_content?.form_value as Record<
    string,
    FormSchemaPropertyValue
  >;

  return Object.entries(formValue)
    .map(([key, value]) => {
      const targetOption = schema?.properties?.[key].oneOf?.find(
        (option) => option.const === value,
      );

      if (!targetOption) return { isVisible: false };

      return {
        property: key,
        widget: schema.properties[key]['dial:widget'],
        type: getFormButtonType(targetOption),
        value,
        label: targetOption?.title,
        isVisible: getFormButtonType(targetOption) !== FormButtonType.Populate,
      };
    })
    .filter(({ isVisible }) => isVisible);
};

interface UserSchemaProps {
  message: Message;
  messageIndex: number;
  allMessages: Message[];
}

const _UserSchema = ({
  message,
  messageIndex,
  allMessages,
}: UserSchemaProps) => {
  const userReplyProperties = useMemo(
    () => getFormActionReplyWidgets(message, messageIndex, allMessages),
    [message, allMessages, messageIndex],
  );

  const isFormReply = isFormActionReply(message);

  // const isSchemaMissing =
  //   isFormReply && !allMessages[messageIndex - 1]?.custom_content?.form_schema;

  if (!isFormReply || !userReplyProperties.length) return null;

  return (
    <div className="mt-2 flex min-w-full items-center gap-2">
      {userReplyProperties
        .filter(({ widget }) => widget === DialWidgets.buttons)
        .map((property) => (
          <button
            key={property.property}
            className="button button-secondary"
            disabled
          >
            {property.label ?? property.value}
          </button>
        ))}

      {/*{isSchemaMissing && (*/}
      {/*  <ErrorMessage error="Message is missing required schema" />*/}
      {/*)}*/}
    </div>
  );
};

_UserSchema.displayName = 'UserSchema';

export const UserSchema = memo(_UserSchema);
