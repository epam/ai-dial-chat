import { FC, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { getPromptRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: PromptInfo[];
}

const RECENT_SECTION_NAME = 'Recent prompts';

export const Prompts: FC<Props> = ({ prompts }) => {
  const { t } = useTranslation(Translation.PromptBar);
  const { handleToggle, isExpanded } = useSectionToggle(
    RECENT_SECTION_NAME,
    FeatureType.Prompt,
  );

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
      name={t('promptbar.recent_prompts.label')}
      onToggle={handleToggle}
      openByDefault={isExpanded}
      dataQa="promps-section"
    >
      <div
        className="flex size-full flex-col gap-1 py-1 pr-0.5"
        data-qa="prompts"
      >
        {promptsToDisplay.map((prompt) => (
          <PromptComponent key={prompt.id} item={prompt} />
        ))}
      </div>
    </CollapsibleSection>
  );
};
