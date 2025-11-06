import { PromptDeleteDialog } from './PromptDeleteDialog';
import { PromptMoveToDialog } from './PromptMoveToDialog';

export const PromptDialogs: React.FC = () => {
  return (
    <>
      <PromptDeleteDialog />
      <PromptMoveToDialog />
    </>
  );
};
