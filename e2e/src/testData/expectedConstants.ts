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
  playbackConversation: '[Playback] ',
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
  defaultIconUrl: 'url(images/icons/message-square-lines-alt.svg))',
  deleteFolderMessage:
    'Are you sure that you want to remove a folder with all nested elements?',
  backgroundColorPattern: /(rgba\(\d+,\s*\d+,\s*\d+),\s*\d+\.*\d+\)/,
  sendMessageTooltip: 'Please type a message',
  proceedReplayTooltip: 'Please continue replay to continue working with chat',
  waitForAssistantAnswerTooltip:
    'Please wait for full assistant answer to continue working with chat',
  selectedPromptOptionAttribute: 'bg-accent-primary-alpha',
  noResults: 'No results found',
  notAllowedModelError:
    'Not allowed model selected. Please, change the model to proceed',
  replayAsIsDescr:
    'This mode replicates user requests from the original conversation including settings set in each message.',
  replayOldVersionWarning:
    'Please note that some of your messages were created in older DIAL version. "Replay as is" could be working not as expected.',
  regenerateResponseTooltip:
    'Please regenerate response to continue working with chat',
  sharedConversationTooltip: 'Shared',
  copyUrlTooltip: 'Copy URL',
  maxSidePanelWidthPercentage: 0.45,
  minSidePanelWidthPx: 260,
  attachments: 'Attachments',
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
  publish = 'Publish',
  update = 'Update',
  unpublish = 'Unpublish',
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
  defaultIconHost: '/api/themes/image?name=default-model',
};

export const Import = {
  importPath: path.resolve(__dirname, 'import'),
  exportPath: path.resolve(__dirname, 'export'),
  oldVersionAppFolderName: 'Version 1.x',
  oldVersionAppFolderChatName: '3-5 GPT math',
  v14AppBisonChatName: 'bison chat king',
  v14AppImportedFilename: 'chatbot_ui_history_1-4_version.json',
  v19AppImportedFilename: 'chatbot_ui_history_1-9_version.json',
  v14AppFolderPromptName: 'Version 1.4 A*B',
  oldVersionAppGpt35Message: '11 * 12 =',
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
  AWS_TITAN = 'amazon.titan-tg1-large',
}

export enum Rate {
  like = 'like',
  dislike = 'dislike',
}

export enum Theme {
  light = 'light',
  dark = 'dark',
}
