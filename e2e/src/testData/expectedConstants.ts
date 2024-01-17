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
  backgroundAccentAttribute: 'bg-accent-primary-alpha',
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
  responseContentPattern: /(?<=\{"content":")[^"^\\$]+/g,
  responseFileUrlPattern: /(?<="url":")[^"$]+/g,
  responseFileUrlContentPattern: (model: string) =>
    new RegExp('/appdata/' + model + '/images/.*\\.png', 'g'),
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

export enum FilterMenuOptions {
  sharedByMe = 'Shared by me',
  publishedByMe = 'Published by me',
}

export enum AccountMenuOptions {
  settings = 'Settings',
  logout = 'Log out',
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
  bucketHost: '/api/files/bucket',
  fileHost: '/api/files/file',
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

export const Attachment = {
  attachmentPath: path.resolve(__dirname, 'attachments'),
  sunImageName: 'sun.png',
};

export enum Side {
  right = 'right',
  left = 'left',
}

export enum ModelIds {
  GPT_3_5_TURBO = 'gpt-35-turbo',
  GPT_3_5_TURBO_0301 = 'gpt-35-turbo-0301',
  GPT_3_5_TURBO_0613 = 'gpt-35-turbo-0613',
  GPT_3_5_TURBO_1106 = 'gpt-35-turbo-1106',
  GPT_3_5_TURBO_16K = 'gpt-35-turbo-16k',
  GPT_4 = 'gpt-4',
  GPT_4_0314 = 'gpt-4-0314',
  GPT_4_0613 = 'gpt-4-0613',
  GPT_4_TURBO_1106 = 'gpt-4-turbo-1106',
  GPT_4_32K = 'gpt-4-32k',
  GPT_4_32K_0314 = 'gpt-4-32k-0314',
  GPT_4_32K_0613 = 'gpt-4-32k-0613',
  GPT_4_VISION_PREVIEW = 'gpt-4-vision-preview',
  BISON_001 = 'chat-bison@001',
  BISON_32k_002 = 'chat-bison-32k@002',
  CODE_BISON_001 = 'codechat-bison@001',
  CODE_BISON_32K_002 = 'codechat-bison-32k@002',
  DALLE = 'dalle3',
  AWS_TITAN = 'amazon.titan-tg1-large',
  AI21_GRANDE = 'ai21.j2-grande-instruct',
  AI21_JUMBO = 'ai21.j2-jumbo-instruct',
  ANTHROPIC_CLAUDE_INSTANT_V1 = 'anthropic.claude-instant-v1',
  ANTHROPIC_CLAUDE_V1 = 'anthropic.claude-v1',
  ANTHROPIC_CLAUDE_V2 = 'anthropic.claude-v2',
  ANTHROPIC_CLAUDE_V21 = 'anthropic.claude-v2-1',
  STABLE_DIFFUSION = 'stability.stable-diffusion-xl',
  IMAGE_GENERATION_005 = 'imagegeneration@005',
  GEMINI_PRO_VISION = 'gemini-pro-vision',
  GEMINI_PRO = 'gemini-pro',
}

export enum AddonIds {
  WOLFRAM = 'addon-wolfram',
  XWEATHER = 'addon-xweather',
}

export enum Rate {
  like = 'like',
  dislike = 'dislike',
}

export enum Theme {
  light = 'light',
  dark = 'dark',
}
