import { FC, useCallback, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { getPromptRootId } from '@/src/utils/app/id';

import { Prompt, PromptInfo } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import CollapsableSection from '@/src/components/Common/CollapsableSection';

import { PromptComponent } from './Prompt';
import { PromptModal } from './PromptModal';

interface Props {
  prompts: PromptInfo[];
}

export const Prompts: FC<Props> = ({ prompts }) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation(Translation.PromptBar);

  const { showModal, isModalPreviewMode } = useAppSelector(
    PromptsSelectors.selectIsEditModalOpen,
  );
  const isNewPromptCreating = useAppSelector(
    PromptsSelectors.selectIsNewPromptCreating,
  );

  const promptsToDisplay = useMemo(() => {
    const promptRootId = getPromptRootId();
    return prompts
      .filter((prompt) => prompt.folderId === promptRootId) // only my root prompts
      .reverse();
  }, [prompts]);

  const handleUpdate = useCallback(
    (prompt: Prompt) => {
      isNewPromptCreating
        ? dispatch(PromptsActions.createNewPrompt(prompt))
        : dispatch(
            PromptsActions.updatePrompt({
              id: prompt.id,
              values: {
                name: prompt.name,
                description: prompt.description,
                content: prompt.content,
                isShared: prompt.isShared,
              },
            }),
          );
      dispatch(PromptsActions.resetSearch());
    },
    [dispatch, isNewPromptCreating],
  );

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setIsEditModalOpen({ isOpen: false }));
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
  }, [dispatch]);

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
        className="flex size-full flex-col gap-1 py-1 pr-0.5"
        data-qa="prompts"
      >
        {promptsToDisplay.map((prompt) => (
          <PromptComponent key={prompt.id} item={prompt} />
        ))}
      </div>
      {showModal && !isModalPreviewMode && (
        <PromptModal
          isOpen
          onClose={handleClose}
          onUpdatePrompt={handleUpdate}
        />
      )}
    </CollapsableSection>
  );
};
