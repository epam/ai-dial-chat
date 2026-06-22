import { memo, useCallback, useMemo } from 'react';

import classNames from 'classnames';

import { removeDescriptionsFromSchema } from '@/src/utils/app/form-schema';

import { MarketplaceEditorSteps } from '@/src/types/marketplace';

import { ChatActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  ChatSelectors,
  ConversationsSelectors,
  ModelsSelectors,
  UISelectors,
} from '@/src/store/selectors';

import { FormSchema } from '@/src/components/Chat/ChatMessage/MessageSchema/FormSchema';

import {
  DialSchemaProperties,
  MessageFormSchema,
  MessageFormValueType,
} from '@epam/ai-dial-shared';

interface ChatStartersViewProps {
  schema: MessageFormSchema;
  modelId: string;
}

const ChatStartersView = ({ schema, modelId }: ChatStartersViewProps) => {
  const dispatch = useAppDispatch();

  const isChatFullWidth = useAppSelector(UISelectors.selectIsChatFullWidth);
  const formValue = useAppSelector(ChatSelectors.selectChatFormValue);

  const handleChange = useCallback(
    (property: string, value: MessageFormValueType, submit?: boolean) => {
      const populateText = schema.properties[property]?.oneOf?.find(
        (option) => option.const === value,
      )?.[DialSchemaProperties.DialWidgetOptions]?.populateText;

      dispatch(
        ChatActions.setFormValue({
          property,
          content: populateText,
          value,
          submit,
          modelId,
        }),
      );
    },
    [dispatch, schema, modelId],
  );

  const schemaWithoutDescription = useMemo(
    () => removeDescriptionsFromSchema(schema),
    [schema],
  );

  return (
    <FormSchema
      schema={schemaWithoutDescription}
      formValue={formValue}
      showSelected
      onChange={handleChange}
      buttonsWrapperClassName="overflow-y-hidden justify-center"
      buttonClassName="shrink-0"
      wrapperClassName="items-center"
      propertyWrapperClassName={classNames(
        'max-w-full px-4',
        isChatFullWidth ? 'lg:px-20' : 'lg:w-[768px]',
      )}
    />
  );
};

export const ChatStarters = memo(function ChatStarters() {
  const selectedConversations = useAppSelector(
    ConversationsSelectors.selectSelectedConversations,
  );
  const isReplay = useAppSelector(
    ConversationsSelectors.selectIsReplaySelectedConversations,
  );
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  const schema = useAppSelector((state) =>
    ChatSelectors.selectConfigurationSchemaByModelId(
      state,
      selectedConversations[0]?.model.id,
      modelsMap,
    ),
  );
  const isSchemaLoading = useAppSelector((state) =>
    ChatSelectors.selectIsConfigurationSchemaLoading(
      state,
      selectedConversations[0]?.model.id,
      modelsMap,
    ),
  );
  const editorStep = useAppSelector(ApplicationSelectors.selectEditorStep);
  const isApplicationLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const isEditorSettingsUpdating =
    editorStep === MarketplaceEditorSteps.Settings && isApplicationLoading;

  if (
    selectedConversations.length > 1 ||
    selectedConversations[0]?.messages?.length > 0 ||
    isSchemaLoading ||
    isEditorSettingsUpdating ||
    !schema ||
    isReplay
  ) {
    return null;
  }

  return (
    <ChatStartersView
      schema={schema}
      modelId={selectedConversations[0].model.id}
    />
  );
});
