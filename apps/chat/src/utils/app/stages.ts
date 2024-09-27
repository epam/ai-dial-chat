import { Message, Role } from '@epam/ai-dial-shared';

export const filterUnfinishedStages = (messages: Message[]): Message[] => {
  let assistentMessageIndex = -1;
  messages.forEach((message, index) => {
    if (message.role === Role.Assistant) {
      assistentMessageIndex = index;
    }
  });
  if (
    assistentMessageIndex === -1 ||
    assistentMessageIndex !== messages.length - 1 ||
    !messages[assistentMessageIndex].custom_content?.stages?.length
  ) {
    return messages;
  }

  const assistentMessage = messages[assistentMessageIndex];
  const updatedMessage: Message = {
    ...assistentMessage,
    ...(assistentMessage.custom_content?.stages?.length && {
      custom_content: {
        ...assistentMessage.custom_content,
        stages: assistentMessage.custom_content.stages.filter(
          (stage) => stage.status != null,
        ),
      },
    }),
  };

  return messages.map((message, index) => {
    if (index === assistentMessageIndex) {
      return updatedMessage;
    }

    return message;
  });
};
