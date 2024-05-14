import { FC, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { getPromptRootId } from '@/src/utils/app/id';

import { PromptInfo } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: PromptInfo[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  const { t } = useTranslation(Translation.PromptBar);
  const promptsToDisplay = useMemo(() => {
    const promptRootId = getPromptRootId();
    return prompts
      .filter((prompt) => prompt.folderId === promptRootId) // only my root prompts
      .reverse();
  }, [prompts]);

  if (!promptsToDisplay.length) {
    return null;
  }

  return (
    <CollapsibleSection
      name={t('Recent')}
      openByDefault
      dataQa="promps-section"
    >
      <div
        className="flex size-full flex-col gap-1 py-1 pr-0.5"
        data-qa="prompts"
      >
        {prompts.map((prompt) => (
          <PromptComponent key={prompt.id} item={prompt} />
        ))}
      </div>
    </CollapsibleSection>
  );
};
