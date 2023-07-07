import { Attachment, Message } from '@/types/chat';

export const parseStreamMessages = (message: string): Partial<Message>[] => {
  let formattedMessage = message;
  if (message.charAt(message.length - 1) === ',') {
    formattedMessage = formattedMessage.slice(0, formattedMessage.length - 1);
  }

  const parsedMessage = JSON.parse('[' + formattedMessage + ']');

  return parsedMessage;
};

export const mergeMessages = (
  source: Message,
  newMessages: Partial<Message>[],
) => {
  newMessages.forEach((newData) => {
    if (newData.role) {
      source.role = newData.role;
    }

    if (newData.content) {
      if (!source.content) {
        source.content = '';
      }
      source.content += newData.content;
    }

    if (newData.custom_content) {
      if (!source.custom_content) {
        source.custom_content = {};
      }

      if (newData.custom_content.attachments) {
        if (!source.custom_content.attachments) {
          source.custom_content.attachments = [];
        }

        source.custom_content.attachments =
          source.custom_content.attachments.concat(
            newData.custom_content.attachments,
          );
      }
    }

    if (newData.state) {
      source.state = newData.state;
    }
  });

  return source;
};
