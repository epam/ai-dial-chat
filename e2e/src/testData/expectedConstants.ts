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
  askEpamPresaleApp: 'Ask EPAM Pre-sales',
  epamPresalesFAQAddon: 'EPAM Pre-sales FAQ Addon',
  epamPresalesSearchAddon: 'EPAM Pre-sales Search Addon',
  presalesAssistant: 'Pre-sales Assistant',
  recentModelIds: 'gpt-35-turbo,gpt-4,epam10k-semantic-search,gpt-world,mirror',
  recentAddonIds:
    'addon-epam10k-golden-qna,addon-epam10k-semantic-search,addon-wolfram',
  replayConversation: '[Replay] ',
  proceedReplayLabel:
    'Looks like something went wrong. Do you want to restart replay?',
  answerError:
    'Error happened during answering. Please check your internet connection and try again.',
  noConversationsAvailable: 'No conversations available',
  talkToReply: 'Replay as is',
  fillVariablesAlertText: 'Please fill out all variables',
  enterMessageAlert: 'Please enter a message',
  clearAllConversationsAlert: 'Are you sure you want to clear all messages?',
  defaultIconUrl: 'url(images/icons/message-square-lines-alt.svg))',
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
};

export const Import = {
  importPath: path.resolve(__dirname, 'import'),
  exportPath: path.resolve(__dirname, 'export'),
  v14AppFolderName: 'Version 1.4',
  v14AppFolderChatName: '3-5 GPT math',
  v14AppBisonChatName: 'bison chat king',
  v14AppImportedFilename: 'chatbot_ui_history_1-4_version.json',
};
