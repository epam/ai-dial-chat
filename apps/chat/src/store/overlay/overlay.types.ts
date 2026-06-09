import { ChatOverlayOptions, MessageButtons } from '@epam/ai-dial-shared';

export interface OverlayState {
  // Special property to check against when comparing new overlay options
  // Do not use for regular usage
  _savedOverlayOptions: ChatOverlayOptions | undefined;
  /** Latest theme from host setOverlayOptions; applied when theme listing loads. */
  requestedOverlayTheme?: string;

  hostDomain: string;

  systemPrompt: string | null;
  temperature: number | null;
  newConversationsFolder: string | null;

  readyToInteractSent: boolean;
  optionsReceived?: boolean;
  validationUserEmail: string | null;

  customMessageButtons: MessageButtons[];
}
