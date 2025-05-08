import { ReactNode } from 'react';

import { useChatUploadFiles } from '@/src/hooks/useChatUploadFiles';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.selectors';
import { useAppSelector } from '@/src/store/hooks';

import { FileDropArea } from '@/src/components/Files/FIleDropArea';

interface ChatDropAreaProps {
  children: ReactNode;
}

export const ChatDropArea = ({ children }: ChatDropAreaProps) => {
  const canAttachFiles = useAppSelector(
    ConversationsSelectors.selectCanAttachFile,
  );

  const handleUploadFiles = useChatUploadFiles();

  return (
    <FileDropArea
      className="min-w-0 shrink grow basis-0 overflow-hidden"
      onDrop={handleUploadFiles}
      droppable={canAttachFiles}
    >
      {children}
    </FileDropArea>
  );
};
