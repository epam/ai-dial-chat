import { FC, useMemo } from 'react';

import { Prompt } from '@/src/types/prompt';

import { PromptComponent } from './Prompt';
import CollapsedSection from '@/src/components/Common/CollapsedSection';
import { Translation } from '@/src/types/translation';
import { useTranslation } from 'next-i18next';

interface Props {
  prompts: Prompt[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  const { t } = useTranslation(Translation.PromptBar);
  const promptsToDisplay = useMemo(
    () => prompts.filter((prompt) => !prompt.folderId).reverse(),
    [prompts],
  );
  return (
    <CollapsedSection name={t('Recent')} openByDefault dataQa='promps-section'>
      <div
        className="flex h-full w-full flex-col gap-0.5 py-1 pr-0.5"
        data-qa="prompts"
      >
        {promptsToDisplay
          .map((prompt) => (
            <PromptComponent key={prompt.id} item={prompt} />
          ))}
      </div>
    </CollapsedSection>
  );
};
