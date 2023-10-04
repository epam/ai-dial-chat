import { FC } from 'react';

import { Prompt } from '@/src/types/prompt';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: Prompt[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  return (
    <div
      className="flex h-full w-full flex-col gap-1 py-2 pl-2 pr-0.5"
      data-qa="prompts"
    >
      {prompts
        .slice()
        .reverse()
        .map((prompt, index) => (
          <PromptComponent key={index} prompt={prompt} />
        ))}
    </div>
  );
};
