import { Message, Stage } from '@/types/chat';

export const parseStreamMessages = (message: string): Partial<Message>[] => {
  let formattedMessage = message;
  if (message.charAt(message.length - 1) === ',') {
    formattedMessage = formattedMessage.slice(0, formattedMessage.length - 1);
  }
  const parsedMessage = formattedMessage.split('\0').filter(msg => !!msg).map(chunk => JSON.parse(chunk));

  return parsedMessage;
};

const mergeStages = (sourceStages: Stage[], newStages: Stage[]) => {
    const sourceStagesReducer = sourceStages.reduce((acc, curr) => {
        acc[curr.index] = curr;

        return acc;
    }, <Record<number, Stage>>{});

    newStages.forEach(stage => {
      if (sourceStagesReducer[stage.index]) {
        if (stage.attachments) {
            sourceStagesReducer[stage.index].attachments = (sourceStagesReducer[stage.index].attachments || [])?.concat(stage.attachments);
        }

        if (stage.content) {
            sourceStagesReducer[stage.index].content = (sourceStagesReducer[stage.index].content || '') + stage.content;
        }

        if (stage.name) {
            sourceStagesReducer[stage.index].name = (sourceStagesReducer[stage.index].name || '') + stage.name;
        }

        if (stage.status) {
            sourceStagesReducer[stage.index].status = stage.status;
        }
      } else {
          sourceStagesReducer[stage.index] = stage;
      }
    });

    return Object.values(sourceStagesReducer);
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

      if (newData.custom_content.stages) {

        if (!source.custom_content.stages) {
          source.custom_content.stages = [];
        }
        source.custom_content.stages = mergeStages(
          source.custom_content.stages,
          newData.custom_content.stages,
        );
      }
    }

    if (newData.state) {
      source.state = newData.state;
    }
  });

  return source;
};
