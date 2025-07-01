import { ChatOverlayOptions, MessageButtons } from '@epam/ai-dial-shared';

export interface OverlayState {
  // Special property to check against when comparing new overlay options
  // Do not use for regular usage
  _savedOverlayOptions: ChatOverlayOptions | undefined;

  hostDomain: string;

  systemPrompt: string | null;
  newConversationsFolder: string | null;

  readyToInteractSent: boolean;
  optionsReceived?: boolean;

  customMessageButtons: MessageButtons[];
}
