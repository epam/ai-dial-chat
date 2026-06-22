import { HIDDEN_FILE } from '@epam/ai-dial-chat-shared';

export const isHiddenPath = (path: string): boolean =>
  path.includes(HIDDEN_FILE);
