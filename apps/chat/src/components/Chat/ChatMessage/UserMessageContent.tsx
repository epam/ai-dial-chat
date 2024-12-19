import { memo, useMemo } from 'react';

import classNames from 'classnames';

import { isSmallScreen } from '@/src/utils/app/mobile';

import { useAppSelector } from '@/src/store/hooks';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import {
  DialMessageFormSchema,
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
  if (!isFormActionReply(message)) return [];
  const schema = allMessages[index - 1]?.custom_content
    ?.form_schema as DialMessageFormSchema;
  const formValue = message.custom_content?.form_value as Record<
    string,
    FormSchemaPropertyValue
  >;

  return Object.entries(schema.properties).map(([key, value]) => ({
    property: key,
    widget: value['dial:widget'],
    value: formValue[key],
    label: value.oneOf?.find((option) => option.const === formValue[key])
      ?.title,
  }));
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

  const isFormActionReplyMsg = isFormActionReply(message);
  const userReplyProperties = useMemo(
    () => getFormActionReplyWidgets(message, messageIndex, allMessages),
    [message, allMessages, messageIndex],
  );

  return (
    <div
      className={classNames('prose min-w-full flex-1 whitespace-pre-wrap', {
        'max-w-none': isChatFullWidth,
        'text-sm': isOverlay,
        'leading-[150%]': isMobileOrOverlay,
      })}
    >
      <span>{message.content}</span>
      {isFormActionReplyMsg && (
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
        </div>
      )}
    </div>
  );
};

export const UserMessageContent = memo(_UserMessageContent);
