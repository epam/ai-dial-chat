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

const isFormActionReply = (
  message: Message,
  index: number,
  allMessages: Message[],
) => {
  if (index === 0 || !allMessages[index - 1]?.custom_content?.form_schema)
    return false;

  try {
    if (JSON.parse(message.content)) return true;
  } catch {
    return false;
  }
};

const getFormActionReplyWidgets = (
  message: Message,
  index: number,
  allMessages: Message[],
) => {
  if (!isFormActionReply(message, index, allMessages)) return [];
  const schema = allMessages[index - 1]?.custom_content
    ?.form_schema as DialMessageFormSchema;
  const parsedReply: Record<string, FormSchemaPropertyValue> = JSON.parse(
    message.content,
  );

  return Object.entries(schema.properties).map(([key, value]) => ({
    property: key,
    widget: value['dial:widget'],
    value: parsedReply[key],
    label: value.oneOf?.find((option) => option.const === parsedReply[key])
      ?.title,
  }));
};

interface UserMessageContentProps {
  message: Message;
  messageIndex: number;
  allMessages: Message[];
}

export const UserMessageContent = ({
  message,
  messageIndex,
  allMessages,
}: UserMessageContentProps) => {
  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const isOverlay = useAppSelector(SettingsSelectors.selectIsOverlay);
  const isMobileOrOverlay = isSmallScreen() || isOverlay;

  const isFormActionReplyMsg = isFormActionReply(
    message,
    messageIndex,
    allMessages,
  );
  const userReplyProperties = getFormActionReplyWidgets(
    message,
    messageIndex,
    allMessages,
  );

  return (
    <div
      className={classNames('prose min-w-full flex-1 whitespace-pre-wrap', {
        'max-w-none': isChatFullWidth,
        'text-sm': isOverlay,
        'leading-[150%]': isMobileOrOverlay,
      })}
    >
      {isFormActionReplyMsg ? (
        <div className="flex items-center gap-2">
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
      ) : (
        message.content
      )}
    </div>
  );
};
