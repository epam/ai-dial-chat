import { useCallback } from 'react';

import classNames from 'classnames';

import { ChatActions, ChatSelectors } from '@/src/store/chat/chat.reducer';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import {
  DialMessageFormSchema,
  DialWidgets,
  FormSchemaButtonOption,
} from '@epam/ai-dial-shared';

interface ButtonWidgetProps {
  constValue: number;
  title: string;
  widgetOptions: FormSchemaButtonOption['dial:widgetOptions'];
  isLastMessage: boolean;
  property: string;
}

const ButtonWidget = ({
  title,
  constValue,
  widgetOptions,
  isLastMessage,
  property,
}: ButtonWidgetProps) => {
  const dispatch = useAppDispatch();

  const formOptions = useAppSelector(ChatSelectors.selectChatFormOptions);

  const isSelected = isLastMessage && formOptions?.[property] === constValue;

  const handleClick = useCallback(() => {
    if (isLastMessage && widgetOptions?.populateText && !widgetOptions.submit) {
      dispatch(
        ChatActions.setFormOptions({
          content: widgetOptions.populateText,
          property,
          value: constValue,
        }),
      );
    }
  }, [isLastMessage, widgetOptions, dispatch, property, constValue]);

  return (
    <button
      onClick={handleClick}
      className={classNames(
        'button button-secondary',
        isSelected && '!border-accent-primary',
      )}
      disabled={!isLastMessage}
    >
      {title}
    </button>
  );
};

interface PropertiesMapperProps {
  property: string;
  isLastMessage: boolean;
  widget?: DialWidgets;
  description?: string;
  oneOf?: FormSchemaButtonOption[];
}

const PropertiesMapper = ({
  property,
  isLastMessage,
  widget,
  description,
  oneOf,
}: PropertiesMapperProps) => {
  if (widget === DialWidgets.buttons)
    return (
      <div className="flex flex-col gap-2">
        {description && (
          <p className="mt-2 border-t border-tertiary py-2 text-sm text-primary">
            {description}
          </p>
        )}
        <div className="flex items-center gap-2">
          {oneOf?.map((item) => (
            <ButtonWidget
              key={item.const}
              constValue={item.const}
              title={item.title}
              widgetOptions={item['dial:widgetOptions']}
              isLastMessage={isLastMessage}
              property={property}
            />
          ))}
        </div>
      </div>
    );

  return null;
};

interface MessageFormSchemaProps {
  schema: DialMessageFormSchema;
  isLastMessage: boolean;
}

export const MessageFormSchema = ({
  schema,
  isLastMessage,
}: MessageFormSchemaProps) => {
  return (
    <div>
      {Object.entries(schema.properties).map(([key, property]) => (
        <PropertiesMapper
          key={key}
          property={key}
          isLastMessage={isLastMessage}
          widget={property['dial:widget']}
          oneOf={property.oneOf}
          description={property.description}
        />
      ))}
    </div>
  );
};
