import { getAttachmentIcon } from '@epam/ai-dial-conversation-input';
import { createElement, FC, memo } from 'react';

interface Props {
  contentType: string;
  size?: number;
  className?: string;
}

const FileTypeIcon: FC<Props> = ({ contentType, size = 16, className }) =>
  createElement(getAttachmentIcon(contentType), { size, className });

export default memo(FileTypeIcon);
