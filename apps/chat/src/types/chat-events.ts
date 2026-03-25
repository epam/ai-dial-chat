export enum ChatEventOperations {
  ToolsetSignIn = 'toolset/signin',
}

export enum ChatEventResult {
  Success = 'success',
  Denied = 'denied',
}

export interface ChatEvent {
  id: string;
  method: ChatEventOperations;
  params: {
    toolsetId: string;
  };
}

export type ChatEventResponse = (
  | { result: ChatEventResult }
  | { error: string }
) & {
  id: string;
};
