import { FC } from 'react';

import { Prompt } from '@/types/prompt';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: Prompt[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  return (
    <div className="flex h-full w-full flex-col p-2">
      {prompts
        .slice()
        .reverse()
        .map((prompt, index) => (
          <PromptComponent key={index} prompt={prompt} />
        ))}
    </div>
  );
};
