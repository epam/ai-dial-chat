import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppSelector } from '@/src/store/hooks';

import { ChatInputAttachment } from './ChatInputAttachment';

export const ChatInputAttachments = () => {
  const selectedFiles = useAppSelector(FilesSelectors.selectSelectedFiles);

  if (!selectedFiles.length) {
    return null;
  }

  return (
    <div className="mb-2.5 grid max-h-[100px] grid-cols-3 gap-1 overflow-auto px-12">
      {selectedFiles.map((file) => (
        <ChatInputAttachment key={file.id} file={file} />
      ))}
    </div>
  );
};
