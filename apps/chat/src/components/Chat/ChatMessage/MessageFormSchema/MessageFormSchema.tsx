import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import { Translation } from '@/src/types/translation';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { useAppDispatch } from '@/src/store/hooks';

import { ConfirmDialog } from '@/src/components/Common/ConfirmDialog';

import {
  DialMessageFormSchema,
  DialWidgets,
  FormSchemaButtonOption,
} from '@epam/ai-dial-shared';

interface ButtonWidgetProps {
  isLastMessage: boolean;
  option: FormSchemaButtonOption;
  onClick: (option: FormSchemaButtonOption) => void;
}

const ButtonWidget = ({
  isLastMessage,
  option,
  onClick,
}: ButtonWidgetProps) => {
  return (
    <button
      onClick={() => onClick(option)}
      className="button button-secondary"
      disabled={!isLastMessage}
    >
      {option.title}
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
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const [confirmation, setConfirmation] = useState<FormSchemaButtonOption>();

  const handleSetFormOption = useCallback(
    (option: FormSchemaButtonOption) => {
      dispatch(
        ChatActions.setFormOptions({
          content: option['dial:widgetOptions']?.populateText,
          property,
          value: option.const,
        }),
      );
    },
    [dispatch, property],
  );

  const handleButtonClick = useCallback(
    (option: FormSchemaButtonOption) => {
      if (option['dial:widgetOptions']?.confirmationMessage) {
        return setConfirmation(option);
      }
      handleSetFormOption(option);
    },
    [handleSetFormOption],
  );

  const handleCloseConfirmation = useCallback(
    (result: boolean) => {
      if (result) handleSetFormOption(confirmation as FormSchemaButtonOption);

      setConfirmation(undefined);
    },
    [confirmation, handleSetFormOption],
  );

  if (widget === DialWidgets.buttons)
    return (
      <div className="flex flex-col gap-2">
        {description && (
          <p className="mt-2 border-t border-tertiary py-2 text-sm text-primary">
            {description}
          </p>
        )}
        {isLastMessage && (
          <div className="flex items-center gap-2">
            {oneOf?.map((item) => (
              <ButtonWidget
                key={item.const}
                option={item}
                isLastMessage={isLastMessage}
                onClick={handleButtonClick}
              />
            ))}
          </div>
        )}

        <ConfirmDialog
          isOpen={!!confirmation}
          heading={t(
            confirmation?.['dial:widgetOptions']?.confirmationMessage ?? '',
          )}
          confirmLabel={t('Yes')}
          cancelLabel={t('No')}
          onClose={handleCloseConfirmation}
        />
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
