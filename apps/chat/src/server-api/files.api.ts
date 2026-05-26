import type { ApiAttachment } from '@epam/ai-dial-chat-shared';
import { filesApi } from './api-client';

export const uploadFile = async (file: File): Promise<ApiAttachment> => {
  const response = await filesApi.uploadFile({ file });

  return {
    type: file.type,
    title: response.name,
    url: response.url,
  };
};
