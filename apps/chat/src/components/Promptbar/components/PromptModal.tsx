import { useCallback, useState } from 'react';

import classNames from 'classnames';

import { regeneratePromptId } from '@/src/utils/app/prompts';

import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { Modal } from '@/src/components/Common/Modal';
import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';

import { EditPrompt } from './EditPrompt';
import { ViewPrompt } from './ViewPrompt';

import { PublishActions } from '@epam/ai-dial-shared';

interface PromptModalViewProps {
  prompt: Prompt;
  isViewMode: boolean;
  onToggleEditMode: (isOpen: boolean) => void;
  onClose: () => void;
}

const PromptModalView: React.FC<PromptModalViewProps> = ({
  prompt,
  isViewMode,
  onToggleEditMode,
  onClose,
}) => {
  const isNewPromptCreating = useAppSelector(
    PromptsSelectors.selectIsNewPromptCreating,
  );

  const dispatch = useAppDispatch();

  const handleEdit = useCallback(
    (editedPrompt: Prompt) => {
      const regeneratePrompt = regeneratePromptId(editedPrompt);

      if (isNewPromptCreating) {
        dispatch(PromptsActions.createNewPrompt(regeneratePrompt));
        onClose();
      } else {
        if (
          editedPrompt.name !== prompt.name ||
          editedPrompt.content !== prompt.content ||
          editedPrompt.description !== prompt.description
        ) {
          dispatch(
            PromptsActions.updatePrompt({
              id: prompt.id,
              values: editedPrompt,
            }),
          );
          dispatch(
            PromptsActions.setSelectedPrompt({
              promptId: regeneratePrompt.id,
            }),
          );
          dispatch(PromptsActions.uploadPromptSuccess({ prompt: null }));
        }

        onToggleEditMode(true);
      }
    },
    [
      dispatch,
      isNewPromptCreating,
      onClose,
      onToggleEditMode,
      prompt.content,
      prompt.description,
      prompt.id,
      prompt.name,
    ],
  );

  const handleGoToEditMode = useCallback(() => {
    onToggleEditMode(false);
  }, [onToggleEditMode]);

  if (isViewMode && !isNewPromptCreating) {
    return (
      <ViewPrompt
        prompt={prompt}
        onEditMode={handleGoToEditMode}
        onClose={onClose}
      />
    );
  }

  return <EditPrompt onEdit={handleEdit} prompt={prompt} />;
};

export const PromptModal = () => {
  const prompt = useAppSelector(PromptsSelectors.selectSelectedOrNewPrompt);
  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);

  const [isViewMode, setIsViewMode] = useState(true);

  const dispatch = useAppDispatch();

  const handleToggleEditMode = useCallback((isOpen: boolean) => {
    setIsViewMode(isOpen);
  }, []);

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setIsEditModalOpen({ isOpen: false }));
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
  }, [dispatch]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="flex flex-col gap-4 inline-block w-full overflow-y-auto px-3 py-4 align-bottom transition-all md:p-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
      dataQa={isViewMode ? 'preview-prompt-modal' : 'prompt-modal'}
      headingClassName={classNames(
        prompt &&
          prompt.publicationInfo?.action === PublishActions.DELETE &&
          'text-error',
      )}
      state={isLoading ? ModalState.LOADING : ModalState.OPENED}
      heading={prompt?.name}
      onClose={handleClose}
    >
      {prompt ? (
        <PromptModalView
          prompt={prompt}
          isViewMode={isViewMode}
          onToggleEditMode={handleToggleEditMode}
          onClose={handleClose}
        />
      ) : (
        <NotFoundEntity entity="Prompt" />
      )}
    </Modal>
  );
};
