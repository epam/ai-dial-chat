import { DialFile } from '@/src/types/files';

import { ChatInputAttachment } from './ChatInputAttachment';

interface Props {
  files: Pick<DialFile, 'name' | 'id' | 'status' | 'percent'>[];

  onUnselectFile?: (fileId: string) => void;
  onRetryFile?: (fileId: string) => void;
}

export const ChatInputAttachments = ({
  files,
  onUnselectFile,
  onRetryFile,
}: Props) => {
  if (!files.length) {
    return null;
  }

  return files.map((file) => (
    <ChatInputAttachment
      key={file.id}
      file={file}
      onUnselectFile={onUnselectFile}
      onRetryFile={onRetryFile}
    />
  ));
};
