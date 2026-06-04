import { userConfigApi } from './api-client';

export const pinConversation = (conversationId: string, isPinned: boolean) =>
  userConfigApi.updatePin({
    updatePinsDto: { path: conversationId, isPinned },
  });
