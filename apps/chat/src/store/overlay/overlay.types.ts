export interface OverlayState {
  hostDomain: string;

  systemPrompt: string | null;

  readyToInteractSent: boolean;
  optionsReceived?: boolean;
}
