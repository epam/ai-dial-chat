import { useCallback } from 'react';

import { PromptsActions } from '@/src/store/actions';
import { ChatActions } from '@/src/store/chat/chat.reducer';
import { useAppDispatch } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/selectors';

import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';

import { PromptVariablesDialog } from './PromptVariablesDialog';

import { Prompt } from '@epam/ai-dial-shared';

interface PromptVariablesForApplyDialogProps {
  prompt: Prompt;
}

const view = withRenderWhenEntities<PromptVariablesForApplyDialogProps>({
  prompt: PromptsSelectors.selectPromptWithVariablesForApply,
})(({ prompt }: PromptVariablesForApplyDialogProps) => {
  const dispatch = useAppDispatch();

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setPromptWithVariablesForApply());
  }, [dispatch]);

  const handleSubmit = useCallback(
    (updatedContent: string) => {
      dispatch(
        ChatActions.appendInputContentWithMapping({
          substituted: updatedContent,
          original: prompt.content ?? '',
        }),
      );
      handleClose();
    },
    [dispatch, handleClose, prompt.content],
  );
  return (
    <PromptVariablesDialog
      prompt={prompt}
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  );
});

export const PromptVariablesForApplyDialog = view;
