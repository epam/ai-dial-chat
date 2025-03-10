export interface OverlayState {
  hostDomain: string;

  systemPrompt: string | null;
  newConversationsFolder: string | null;

  readyToInteractSent: boolean;
  optionsReceived?: boolean;
}
