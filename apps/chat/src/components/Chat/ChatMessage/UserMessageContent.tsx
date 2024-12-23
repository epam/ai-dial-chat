import { memo, useMemo } from 'react';

import classNames from 'classnames';

// import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { getFormButtonType } from '@/src/utils/app/form-schema';
import { isSmallScreen } from '@/src/utils/app/mobile';

import { FormButtonType } from '@/src/types/chat';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

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

interface UserMessageContentProps {
  message: Message;
  messageIndex: number;
  allMessages: Message[];
}

const _UserMessageContent = ({
  message,
  messageIndex,
  allMessages,
}: UserMessageContentProps) => {
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isMobileOrOverlay = isSmallScreen() || isOverlay;

  const userReplyProperties = useMemo(
    () => getFormActionReplyWidgets(message, messageIndex, allMessages),
    [message, allMessages, messageIndex],
  );

  const isFormReply = isFormActionReply(message);

  // const isSchemaMissing = isFormReply && !allMessages[messageIndex - 1]?.custom_content?.form_schema;

  return (
    <div
      className={classNames('prose min-w-full flex-1 whitespace-pre-wrap', {
        'max-w-none': isChatFullWidth,
        'text-sm': isOverlay,
        'leading-[150%]': isMobileOrOverlay,
      })}
    >
      <span>{message.content}</span>
      {isFormReply && (
        <div className="mt-2 flex items-center gap-2">
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
      )}
    </div>
  );
};

export const UserMessageContent = memo(_UserMessageContent);
