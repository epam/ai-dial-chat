import { useCallback, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import {
  arePromptsFieldsTheSame,
  regeneratePromptId,
} from '@/src/utils/app/prompts';

import { ModalState } from '@/src/types/modal';
import { Prompt } from '@/src/types/prompt';
import { Translation } from '@/src/types/translation';

import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { Modal } from '@/src/components/Common/Modal';
import { NotFoundEntity } from '@/src/components/Common/NotFoundEntity';

import { withRenderWhen } from '../../Common/RenderWhen';
import { EditPrompt } from './EditPrompt';
import { ViewPrompt } from './ViewPrompt';

import { PublishActions } from '@epam/ai-dial-shared';

interface PromptModalViewProps {
  prompt: Prompt;
  isViewMode: boolean;
  onToggleEditMode: (isOpen: boolean) => void;
  onClose: () => void;
}

const PromptModalContent: React.FC<PromptModalViewProps> = ({
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
      } else {
        if (arePromptsFieldsTheSame(editedPrompt, prompt)) {
          dispatch(
            PromptsActions.updatePrompt({
              id: prompt.id,
              values: editedPrompt,
            }),
          );
        }
      }

      dispatch(
        PromptsActions.setSelectedPrompt({
          promptId: regeneratePrompt.id,
        }),
      );
      dispatch(PromptsActions.uploadPromptSuccess({ prompt: null }));

      onToggleEditMode(true);
    },
    [dispatch, isNewPromptCreating, onToggleEditMode, prompt],
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

  return <EditPrompt onEdit={handleEdit} onClose={onClose} prompt={prompt} />;
};

const PromptModalView = () => {
  const { t } = useTranslation(Translation.PromptBar);

  const prompt = useAppSelector(PromptsSelectors.selectSelectedOrNewPrompt);
  const isLoading = useAppSelector(PromptsSelectors.isPromptLoading);
  const isPromptInitModeEdit = useAppSelector(
    PromptsSelectors.selectIsPromptModalInitModelEdit,
  );
  const isNewPromptCreating = useAppSelector(
    PromptsSelectors.selectIsNewPromptCreating,
  );

  const [isViewMode, setIsViewMode] = useState(
    !isNewPromptCreating && !isPromptInitModeEdit,
  );

  const dispatch = useAppDispatch();

  const handleToggleEditMode = useCallback((isOpen: boolean) => {
    setIsViewMode(isOpen);
  }, []);

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setIsPromptModalOpen({ isOpen: false }));
    dispatch(PromptsActions.setSelectedPrompt({ promptId: undefined }));
  }, [dispatch]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName="flex flex-col gap-4 w-full py-4 md:py-6 xl:max-h-[800px] xl:max-w-[720px] 2xl:max-w-[1000px]"
      dataQa={
        prompt?.content === '' || !isViewMode
          ? 'prompt-modal'
          : 'preview-prompt-modal'
      }
      headingClassName={classNames(
        'px-3 md:px-6',
        prompt &&
          prompt.publicationInfo?.action === PublishActions.DELETE &&
          'text-error',
      )}
      state={isLoading ? ModalState.LOADING : ModalState.OPENED}
      heading={t(isViewMode ? 'View Prompt' : 'Edit Prompt')}
      hideClose={!isViewMode}
      onClose={handleClose}
    >
      {prompt ? (
        <PromptModalContent
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

export const PromptModal = withRenderWhen(
  PromptsSelectors.selectIsPromptModalOpen,
)(PromptModalView);
