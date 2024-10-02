import { Message, Stage } from '@epam/ai-dial-shared';

export const parseStreamMessages = (message: string): Partial<Message>[] => {
  const parsedMessage = message
    .split('\0')
    .filter((msg) => !!msg)
    .map((chunk) => JSON.parse(chunk));

  return parsedMessage;
};

const mergeStages = (sourceStages: Stage[], newStages: Stage[]) => {
  const sourceStagesReducer = sourceStages.reduce(
    (acc, curr) => {
      acc[curr.index] = curr;

      return acc;
    },
    {} as Record<number, Stage>,
  );

  newStages.forEach((stage) => {
    if (sourceStagesReducer[stage.index]) {
      if (stage.attachments) {
        sourceStagesReducer[stage.index].attachments = (
          sourceStagesReducer[stage.index].attachments || []
        ).concat(stage.attachments);
      }

      if (stage.content) {
        sourceStagesReducer[stage.index].content =
          (sourceStagesReducer[stage.index].content || '') + stage.content;
      }

      if (stage.name) {
        sourceStagesReducer[stage.index].name =
          (sourceStagesReducer[stage.index].name || '') + stage.name;
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
  const newSource = structuredClone(source);
  newMessages.forEach((newData) => {
    if (newData.errorMessage) {
      newSource.errorMessage = newData.errorMessage;
    }

    if (newData.role) {
      newSource.role = newData.role;
    }

    if (newData.responseId) {
      newSource.responseId = newData.responseId;
    }

    if (newData.content) {
      if (!newSource.content) {
        newSource.content = '';
      }
      newSource.content += newData.content;
    }

    if (newData.custom_content) {
      if (!newSource.custom_content) {
        newSource.custom_content = {};
      }

      if (newData.custom_content.attachments) {
        if (!newSource.custom_content.attachments) {
          newSource.custom_content.attachments = [];
        }

        newSource.custom_content.attachments =
          newSource.custom_content.attachments.concat(
            newData.custom_content.attachments,
          );
      }

      if (newData.custom_content.stages) {
        if (!newSource.custom_content.stages) {
          newSource.custom_content.stages = [];
        }
        newSource.custom_content.stages = mergeStages(
          newSource.custom_content.stages,
          newData.custom_content.stages,
        );
      }

      if (newData.custom_content.state) {
        newSource.custom_content.state = newData.custom_content.state;
      }
    }
  });
  return newSource;
};
