import { IconBulb } from '@tabler/icons-react';

import { Tooltip } from '../Tooltip';
import { EntityRow, FeatureRowProps } from './ReplaceEntityRow';
import { FeatureContainer } from './ReplaceRowContainer';

import { Prompt } from '@epam/ai-dial-shared';

interface PromptViewProps {
  item: Prompt;
}

const PromptView = ({ item: prompt }: PromptViewProps) => {
  return (
    <FeatureContainer>
      <span className="flex shrink-0">
        <IconBulb size={18} className="text-secondary" />
      </span>
      <Tooltip
        tooltip={prompt.name}
        contentClassName="break-all"
        triggerClassName="truncate whitespace-pre"
        dataQa="entity-name"
      >
        {prompt.name}
      </Tooltip>
    </FeatureContainer>
  );
};

interface PromptRowProps extends PromptViewProps, FeatureRowProps {}

export const PromptsRow = ({
  item: prompt,
  additionalItemData,
  level,
  onEvent,
}: PromptRowProps) => {
  return (
    <EntityRow
      entityId={prompt.id}
      additionalItemData={additionalItemData}
      level={level}
      onEvent={onEvent}
      dataQA="prompt"
    >
      <PromptView item={prompt} />
    </EntityRow>
  );
};
