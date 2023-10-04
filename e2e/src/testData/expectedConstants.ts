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
  fillVariablesAlertText: 'Please fill out all variables',
  enterMessageAlert: 'Please enter a message',
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
