import { FC, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import CollapsableSection from '@/src/components/Common/CollapsableSection';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: Prompt[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  const { t } = useTranslation(Translation.PromptBar);
  const promptsToDisplay = useMemo(
    () => prompts.filter((prompt) => !prompt.folderId).reverse(),
    [prompts],
  );

  if (!promptsToDisplay.length) {
    return null;
  }

  return (
    <CollapsableSection
      name={t('Recent')}
      openByDefault
      dataQa="promps-section"
    >
      <div
        className="flex h-full w-full flex-col gap-1 py-1 pr-0.5"
        data-qa="prompts"
      >
        {promptsToDisplay.map((prompt) => (
          <PromptComponent key={prompt.id} item={prompt} />
        ))}
      </div>
    </CollapsableSection>
  );
};
