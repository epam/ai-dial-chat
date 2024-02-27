import { FC, memo } from 'react';

import { ChatMessage, Props } from './ChatMessage/ChatMessage';

export const MemoizedChatMessage: FC<Props> = memo(ChatMessage);
