import config from '../../config/chat.playwright.config';

import path from 'path';

export const ExpectedConstants = {
  newConversationTitle: 'New conversation',
  newConversationWithIndexTitle: (index: number) =>
    `${ExpectedConstants.newConversationTitle} ${index}`,
  entityWithIndexTitle: (name: string, index: number) => `${name} ${index}`,
  newPromptTitle: (index: number) => `Prompt ${index}`,
  promptPlaceholder: (variable: string) => `Enter a value for ${variable}...`,
  newFolderTitle: 'New folder',
  newFolderWithIndexTitle: (index: number) =>
    `${ExpectedConstants.newFolderTitle} ${index}`,
  emptyString: '',
  defaultTemperature: '1',
  signInButtonTitle: 'Sign in with Credentials',
  talkTo: 'Talk to',
  model: 'Model',
  replayAsIsLabel: 'Replay as is',
  replayConversation: '[Replay] ',
  playbackConversation: '[Playback] ',
  emptyPlaybackMessage: 'Type a message',
  startReplayLabel: 'Start replay',
  continueReplayLabel: 'Continue replay',
  continueReplayAfterErrorLabel: 'Try again',
  answerError:
    'Error happened during answering. Please check your internet connection and try again.',
  noConversationsAvailable: 'No conversations available',
  talkToReply: 'Replay as is',
  fillVariablesAlertText: 'Please fill out all variables',
  enterMessageAlert: 'Please enter a message',
  defaultIconUrl: 'url(images/icons/message-square-lines-alt.svg))',
  deleteFolderMessage:
    'Are you sure that you want to delete a folder with all nested elements?',
  deleteFileMessage: 'Are you sure that you want to delete this file',
  deleteFilesMessage: 'Are you sure that you want to delete these files',
  deleteSharedFolderMessage:
    'Are you sure that you want to delete a folder with all nested elements?\n' +
    'Deleting will stop sharing and other users will no longer see this folder.',
  deleteSharedConversationMessage:
    'Are you sure that you want to delete a conversation?\n' +
    'Deleting will stop sharing and other users will no longer see this conversation.',
  renameSharedFolderMessage:
    'Renaming will stop sharing and other users will no longer see this folder.',
  renameSharedConversationMessage:
    'Renaming will stop sharing and other users will no longer see this conversation.',
  backgroundColorPattern: /(rgba\(\d+,\s*\d+,\s*\d+),\s*\d+\.*\d+\)/,
  sendMessageTooltip: 'Please type a message',
  sendMessageAttachmentLoadingTooltip: 'Please wait for the attachment to load',
  proceedReplayTooltip: 'Please continue replay to continue working with chat',
  stopGeneratingTooltip: 'Stop generating',
  backgroundAccentAttribute: 'bg-accent-primary-alpha',
  noResults: 'No results found',
  notAllowedModelError:
    'Not allowed model selected. Please, change the model to proceed',
  replayAsIsDescr:
    'This mode replicates user requests from the original conversation including settings set in each message.',
  replayOldVersionWarning:
    'Please note that some of your messages were created in older DIAL version. "Replay as is" could be working not as expected.',
  regenerateResponseToContinueTooltip:
    'Please regenerate response to continue working with chat',
  regenerateResponseTooltip: 'Regenerate response',
  sharedConversationTooltip: 'Shared',
  sharedConversationName: (name: string) => `Share: ${name}`,
  sharedLink: (invitationLink: string) => {
    const invitationPath = '/v1/invitations/';
    const startIndex =
      invitationLink.indexOf(invitationPath) + invitationPath.length;
    return invitationLink.slice(startIndex);
  },
  sharedConversationUrl: (invitationLink: string) => {
    return `${config.use!.baseURL}/share/${ExpectedConstants.sharedLink(invitationLink)}`;
  },
  shareInviteAcceptanceFailureMessage:
    'Accepting sharing invite failed. Please open share link again to being able to see shared resource.',
  shareInviteDoesNotExist:
    'We are sorry, but the link you are trying to access has expired or does not exist.',
  copyUrlTooltip: 'Copy URL',
  revokeAccessTo: (name: string) => `Confirm unsharing: ${name}`,
  maxSidePanelWidthPercentage: 0.45,
  minSidePanelWidthPx: 260,
  attachments: 'Attachments',
  responseContentPattern: /(?<="content":")[^"^\\$]+/g,
  responseFileUrlPattern: /(?<="url":")[^"$]+/g,
  responseFileUrlContentPattern: (model: string) =>
    new RegExp('/appdata/' + model + '/images/.*\\.png', 'g'),
  shareConversationText:
    'This link is temporary and will be active for 3 days. This conversation and future changes to it will be visible to users who follow the link. Only owner will be able to make changes. Renaming or changing the model will stop sharing.',
  shareFolderText:
    'This link is temporary and will be active for 3 days. This conversation folder and future changes to it will be visible to users who follow the link. Only owner will be able to make changes. Renaming will stop sharing.',
  chatNotFoundMessage:
    'Conversation not found.Please select another conversation.',
  promptNameLabel: 'promptName',
  promptContentLabel: 'content',
  requiredFieldErrorMessage: 'Please fill in all required fields',
  isolatedUrl: (modelId: string) => `${config.use!.baseURL}/models/${modelId}`,
  modelNotFountErrorMessage:
    'Model is not found.Please contact your administrator.',
  nameWithDotErrorMessage: 'Using a dot at the end of a name is not permitted.',
  duplicatedFolderNameErrorMessage: (name: string) =>
    `Folder with name "${name}" already exists in this folder.`,
  duplicatedFolderRootNameErrorMessage: (name: string) =>
    `Folder with name "${name}" already exists at the root.`,
  duplicatedConversationNameErrorMessage: (name: string) =>
    `Conversation with name "${name}" already exists in this folder.`,
  duplicatedConversationRootNameErrorMessage: (name: string) =>
    `Conversation with name "${name}" already exists at the root.`,
  prohibitedNameSymbols: `=,:;{}/%&`,
  // eslint-disable-next-line no-irregular-whitespace
  controlChars: `\b\t\f`,
  attachedFileError: (filename: string) =>
    `You've trying to upload files with incorrect type: ${filename}`,
  allowedSpecialSymbolsInName: 'Test (`~!@#$^*-_+[]\'|<>.?")',
  winAllowedSpecialSymbolsInName: "Test (`~!@#$^_-_+[]'___.__)",
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
  duplicate = 'Duplicate',
  replay = 'Replay',
  playback = 'Playback',
  export = 'Export',
  withAttachments = 'With attachments',
  withoutAttachments = 'Without attachments',
  moveTo = 'Move to',
  share = 'Share',
  unshare = 'Unshare',
  publish = 'Publish',
  update = 'Update',
  unpublish = 'Unpublish',
  delete = 'Delete',
  newFolder = 'New folder',
  attachments = 'Attachments',
  download = 'Download',
}

export enum FilterMenuOptions {
  sharedByMe = 'Shared by me',
  publishedByMe = 'Published by me',
}

export enum AccountMenuOptions {
  settings = 'Settings',
  logout = 'Log out',
}

export enum UploadMenuOptions {
  attachUploadedFiles = 'Attach uploaded files',
  uploadFromDevice = 'Upload from device',
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
  bucketHost: '/api/bucket',
  listingHost: '/api/listing',
  conversationsHost: () => `${API.listingHost}/conversations`,
  promptsHost: () => `${API.listingHost}/prompts`,
  filesListingHost: () => `${API.listingHost}/files`,
  fileHost: '/api/files',
  importFileRootPath: (bucket: string) => `files/${bucket}`,
  modelFilePath: (modelId: string) => `appdata/${modelId}/images`,
  importFilePath: (bucket: string, modelId: string) =>
    `${API.importFileRootPath(bucket)}/${API.modelFilePath(modelId)}`,
  shareInviteAcceptanceHost: '/api/share/accept',
  shareConversationHost: '/api/share/create',
  shareWithMeListing: '/api/share/listing',
  discardShareWithMeItem: '/api/share/discard',
};

export const Import = {
  importPath: path.resolve(__dirname, 'import'),
  exportPath: path.resolve(__dirname, 'export'),
  oldVersionAppFolderName: 'Version 1.x',
  oldVersionAppFolderChatName: '3-5 GPT math',
  v14AppBisonChatName: 'bison chat king',
  v14AppImportedFilename: 'ai_dial_chat_history_1-4_version.json',
  v19AppImportedFilename: 'ai_dial_chat_history_1-9_version.json',
  importedAttachmentsFilename: 'ai_dial_chat_with_attachments.zip',
  importedConversationWithAttachmentsName: `test`,
  importedGpt4VisionAttachmentName: 'SDRequestAttachment.png',
  importedStableDiffusionAttachmentName: 'SDResponseAttachment.png',
  v14AppFolderPromptName: 'Version 1.4 A*B',
  oldVersionAppGpt35Message: '11 * 12 =',
  importAttachmentExtension: '.zip',
};

export const Attachment = {
  attachmentPath: path.resolve(__dirname, 'attachments'),
  sunImageName: 'sun.jpg',
  cloudImageName: 'cloud.jpg',
  heartImageName: 'heart.webp',
  flowerImageName: 'flower.jpg',
  longImageName: 'attachmentWithVeryVeryVeryVeryVeryLongTitleDescription.jpg',
  specialSymbolsName: "special (`~!@#$^-_+[]'.).jpg",
  textName: 'text.txt',
  allTypesExtension: '*/*',
  allTypesLabel: 'all',
  imageTypesExtension: 'image/*',
  imagesTypesLabel: 'images',
  zeroSizeFileName: 'test1.txt',
  incrementedImageName: (index: number) => `test${index}.jpg`,
  dotExtensionImageName: 'testdot..JPg',
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
  GPT_3_5_TURBO_0125 = 'gpt-35-turbo-0125',
  GPT_4 = 'gpt-4',
  GPT_4_0314 = 'gpt-4-0314',
  GPT_4_0613 = 'gpt-4-0613',
  GPT_4_1106_PREVIEW = 'gpt-4-1106-preview',
  GPT_4_0125_PREVIEW = 'gpt-4-0125-preview',
  GPT_4_TURBO_2024_04_29 = 'gpt-4-turbo-2024-04-09',
  GPT_4_TURBO = 'gpt-4-turbo',
  GPT_4_32K = 'gpt-4-32k',
  GPT_4_32K_0314 = 'gpt-4-32k-0314',
  GPT_4_32K_0613 = 'gpt-4-32k-0613',
  GPT_4_VISION_PREVIEW = 'gpt-4-vision-preview',
  GPT_4_O_2024_05_13 = 'gpt-4o-2024-05-13',
  CHAT_BISON = 'chat-bison',
  BISON_001 = 'chat-bison@001',
  BISON_32k_002 = 'chat-bison-32k@002',
  CODE_CHAT_BISON = 'codechat-bison',
  CODE_BISON_001 = 'codechat-bison@001',
  CODE_BISON_32K_002 = 'codechat-bison-32k@002',
  DALLE = 'dall-e-3',
  AWS_TITAN = 'amazon.titan-tg1-large',
  AI21_GRANDE = 'ai21.j2-grande-instruct',
  AI21_JUMBO = 'ai21.j2-jumbo-instruct',
  ANTHROPIC_CLAUDE = 'anthropic.claude',
  ANTHROPIC_CLAUDE_INSTANT_V1 = 'anthropic.claude-instant-v1',
  ANTHROPIC_CLAUDE_V2 = 'anthropic.claude-v2',
  ANTHROPIC_CLAUDE_V21 = 'anthropic.claude-v2-1',
  ANTHROPIC_CLAUDE_V3_SONNET = 'anthropic.claude-v3-sonnet',
  ANTHROPIC_CLAUDE_V3_HAIKU = 'anthropic.claude-v3-haiku',
  ANTHROPIC_CLAUDE_V3_OPUS = 'anthropic.claude-v3-opus',
  STABLE_DIFFUSION = 'stability.stable-diffusion-xl',
  IMAGE_GENERATION_005 = 'imagegeneration@005',
  GEMINI_PRO_1_5 = 'gemini-1.5-pro-preview-0409',
  GEMINI_PRO_VISION = 'gemini-pro-vision',
  GEMINI_PRO = 'gemini-pro',
  META_LLAMA_2 = 'meta.llama2',
  LLAMA2_13B_CHAT_V1 = 'meta.llama2-13b-chat-v1',
  LLAMA2_70B_CHAT_V1 = 'meta.llama2-70b-chat-v1',
  LLAMA3_8B_INSTRUCT_V1 = 'meta.llama3-8b-instruct-v1',
  LLAMA3_70B_INSTRUCT_V1 = 'meta.llama3-70b-instruct-v1',
  COHERE_COMMAND_TEXT_V14 = 'cohere.command-text-v14',
  MISTRAL_LARGE = 'mistral-large-azure',
  DATABRICKS_DBRX_INSTRUCT = 'databricks-dbrx-instruct',
  DATABRICKS_MIXTRAL_8X7B_INSTRUCT = 'databricks-mixtral-8x7b-instruct',
  DATABRICKS_LLAMA_2_70B_CHAT = 'databricks-llama-2-70b-chat',
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

export enum ResultFolder {
  allureChatReport = 'allure-chat-results',
  allureOverlayReport = 'allure-overlay-results',
  htmlReport = 'html-report',
  testResults = 'test-results',
}

export enum ScrollState {
  top = 'top',
  middle = 'middle',
  bottom = 'bottom',
}
