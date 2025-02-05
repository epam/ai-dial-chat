import { useCallback } from 'react';

import { ChatActions } from '@/src/store/chat/chat.reducer';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';

import { withRenderWhen } from '../../Common/RenderWhen';
import { PromptVariablesDialog } from './PromptVariablesDialog';

function PromptVariablesForApplyDialogView() {
  const dispatch = useAppDispatch();

  const prompt = useAppSelector(
    PromptsSelectors.selectPromptWithVariablesForApply,
  );

  const handleClose = useCallback(() => {
    dispatch(PromptsActions.setPromptWithVariablesForApply());
  }, [dispatch]);

  const handleSubmit = useCallback(
    (updatedContent: string) => {
      dispatch(ChatActions.appendInputContent(updatedContent));
      handleClose();
    },
    [dispatch, handleClose],
  );
  return (
    <PromptVariablesDialog
      prompt={prompt!}
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  );
}

export const PromptVariablesForApplyDialog = withRenderWhen(
  PromptsSelectors.selectPromptWithVariablesForApply,
)(PromptVariablesForApplyDialogView);
