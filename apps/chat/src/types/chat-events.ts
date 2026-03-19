export enum ChatEventOperations {
  ToolsetSignIn = 'toolset/signin',
}

export interface ChatEvent {
  id: string;
  method: ChatEventOperations;
  params: {
    toolsetId: string;
  };
}

export type ChatEventResponse = ({ result: string } | { error: string }) & {
  id: string;
};
