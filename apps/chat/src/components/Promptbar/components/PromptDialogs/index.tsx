import { SharingType } from '@/src/types/share';

import { PublishDialog } from '@/src/components/Chat/Publish/PublishDialog';

import { PromptDeleteDialog } from './PromptDeleteDialog';
import { PromptMoveToDialog } from './PromptMoveToDialog';

export const PromptDialogs: React.FC = () => {
  return (
    <>
      <PromptDeleteDialog />
      <PublishDialog type={SharingType.Prompt} />
      <PromptMoveToDialog />
    </>
  );
};
