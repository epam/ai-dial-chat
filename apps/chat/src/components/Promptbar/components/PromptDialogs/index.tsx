import { PromptDeleteDialog } from './PromptDeleteDialog';
import { PromptMoveToDialog } from './PromptMoveToDialog';
import { PromptPublishDialog } from './PromptPublishDialog';

export const PromptDialogs: React.FC = () => {
  return (
    <>
      <PromptDeleteDialog />
      <PromptPublishDialog />
      <PromptMoveToDialog />
    </>
  );
};
