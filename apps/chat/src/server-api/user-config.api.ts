import { userConfigApi } from './api-client';

export const getUserConfig = () => userConfigApi.getUserConfig();

export const pinConversation = (conversationId: string, isPinned: boolean) =>
  userConfigApi.updatePin({
    updatePinsDto: { path: conversationId, isPinned },
  });

export const updateInstalledToolset = (id: string, isInstalled: boolean) =>
  userConfigApi.updateInstalledToolset({
    updateInstalledDto: { id, isInstalled },
  });

export const updateInstalledDeployment = (id: string, isInstalled: boolean) =>
  userConfigApi.updateInstalledDeployment({
    updateInstalledDto: { id, isInstalled },
  });

export const updateInstalledPrompt = (id: string, isInstalled: boolean) =>
  userConfigApi.updateInstalledPrompt({
    updateInstalledPromptDto: { id, isInstalled },
  });

export const updateSelectedDeployment = (id: string | null): Promise<void> =>
  userConfigApi.updateSelectedDeployment({
    updateSelectedDeploymentDto: { id },
  });
