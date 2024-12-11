import { FC, useMemo } from 'react';

import { useSectionToggle } from '@/src/hooks/useSectionToggle';

import { getPromptRootId } from '@/src/utils/app/id';

import { FeatureType } from '@/src/types/common';
import { PromptInfo } from '@/src/types/prompt';

import { RECENT_PROMPTS_SECTION_NAME } from '@/src/constants/sections';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';

import { PromptComponent } from './Prompt';

interface Props {
  prompts: PromptInfo[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  const { handleToggle, isExpanded } = useSectionToggle(
    RECENT_PROMPTS_SECTION_NAME,
    FeatureType.Prompt,
  );

  const additionalPromptData = useMemo(
    () => ({
      isSidePanelItem: true,
    }),
    [],
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
      name={RECENT_PROMPTS_SECTION_NAME}
      onToggle={handleToggle}
      openByDefault={isExpanded}
      isExpanded={isExpanded}
      dataQa="prompts-section"
    >
      <div
        className="flex size-full flex-col gap-1 py-1 pr-0.5"
        data-qa="prompts"
      >
        {promptsToDisplay.map((prompt) => (
          <PromptComponent
            key={prompt.id}
            item={prompt}
            additionalItemData={additionalPromptData}
          />
        ))}
      </div>
    </CollapsibleSection>
  );
};
