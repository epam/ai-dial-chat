export interface Settings {
  theme: string;
}

export interface LastConversationSettings {
  temperature: number;
}

export enum EnterType {
  Enter = 'Enter',
  CtrlEnter = 'CtrlEnter',
}
