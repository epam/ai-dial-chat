import path from 'path';

export const ExpectedConstants = {
  newConversationTitle: 'New conversation',
  newPromptTitle: (index: number) => `Prompt ${index}`,
  promptPlaceholder: (variable: string) => `Enter a value for ${variable}...`,
  newFolderTitle: 'New folder',
  emptyString: '',
  defaultTemperature: '1',
  signInButtonTitle: 'Sign in with Credentials',
  talkTo: 'Talk to',
  model: 'Model',
  replayAsIsLabel: 'Replay as is',
  replayConversation: '[Replay] ',
  startReplayLabel: 'Start replay',
  continueReplayLabel: 'Continue replay',
  continueReplayAfterErrorLabel:
    'Looks like something went wrong. Do you want to continue replay?',
  answerError:
    'Error happened during answering. Please check your internet connection and try again.',
  noConversationsAvailable: 'No conversations available',
  talkToReply: 'Replay as is',
  fillVariablesAlertText: 'Please fill out all variables',
  enterMessageAlert: 'Please enter a message',
  clearAllConversationsAlert: 'Are you sure you want to clear all messages?',
  defaultIconUrl: 'url(images/icons/message-square-lines-alt.svg))',
  deleteFolderMessage:
    'Are you sure that you want to remove a folder with all nested elements?',
  backgroundColorPattern: /(rgba\(\d+,\s*\d+,\s*\d+),\s*\d+\.*\d+\)/,
  sendMessageTooltip: 'Please type a message',
};

export enum Groups {
  models = 'Models',
  assistants = 'Assistants',
  applications = 'Applications',
}

export enum MenuOptions {
  rename = 'Rename',
  edit = 'Edit',
  compare = 'Compare',
  replay = 'Replay',
  playback = 'Playback',
  export = 'Export',
  moveTo = 'Move to',
  share = 'Share',
  delete = 'Delete',
  newFolder = 'New folder',
}

export const Chronology = {
  today: 'Today',
  yesterday: 'Yesterday',
  lastSevenDays: 'Last 7 days',
  lastThirtyDays: 'Last 30 days',
  older: 'Older',
  other: 'Other',
};

export const API = {
  modelsHost: '/api/models',
  addonsHost: '/api/addons',
  chatHost: '/api/chat',
  sessionHost: '/api/auth/session',
};

export const Import = {
  importPath: path.resolve(__dirname, 'import'),
  exportPath: path.resolve(__dirname, 'export'),
  v14AppFolderName: 'Version 1.4',
  v14AppFolderChatName: '3-5 GPT math',
  v14AppBisonChatName: 'bison chat king',
  v14AppImportedFilename: 'chatbot_ui_history_1-4_version.json',
  v14AppFolderPromptName: 'Version 1.4 A*B',
};

export enum Side {
  right = 'right',
  left = 'left',
}

export enum ModelIds {
  GPT_3_5_AZ = 'gpt-35-turbo',
  GPT_4 = 'gpt-4',
  GPT_4_32K = 'gpt-4-32k',
  BISON_001 = 'chat-bison@001',
}
