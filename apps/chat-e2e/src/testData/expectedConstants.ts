import config from '../../config/chat.playwright.config';

import { CopyTableType } from '@/chat/types/chat';
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
  newPromptFolderWithIndexTitle: (index: number) =>
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
  deleteSelectedConversationsMessage:
    'Are you sure that you want to delete selected conversations?',
  deleteSelectedPromptsMessage:
    'Are you sure that you want to delete selected prompts?',
  deleteFileMessage: 'Are you sure that you want to delete this file?',
  deleteFilesMessage: 'Are you sure that you want to delete these files?',
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
  notAllowedDuplicatedFolderNameErrorMessage:
    'Not allowed to have folders with same names',
  duplicatedFolderNameErrorMessage: (name: string) =>
    `Folder with name "${name}" already exists in this folder.`,
  duplicatedFolderRootNameErrorMessage: (name: string) =>
    `Folder with name "${name}" already exists at the root.`,
  duplicatedConversationNameErrorMessage: (name: string) =>
    `Conversation with name "${name}" already exists in this folder.`,
  duplicatedPromptNameErrorMessage: (name: string) =>
    `Prompt with name "${name}" already exists in this folder.`,
  duplicatedRootPromptNameErrorMessage: (name: string) =>
    `Prompt with name "${name}" already exists at the root.`,
  duplicatedConversationRootNameErrorMessage: (name: string) =>
    `Conversation with name "${name}" already exists at the root.`,
  // eslint-disable-next-line no-irregular-whitespace
  controlChars: `\b\t\f`,
  attachedFileError: (filename: string) =>
    `You've trying to upload files with incorrect type: ${filename}`,
  allowedSpecialChars: "(`~!@#$^*-_+[]'|<>.?)",
  allowedSpecialSymbolsInName: () =>
    `Test ${ExpectedConstants.allowedSpecialChars}`,
  winAllowedSpecialSymbolsInName: "Test (`~!@#$^_-_+[]'___._)",
  duplicatedFilenameError: (filename: string) =>
    `Files which you trying to upload already presented in selected folder. Please rename or delete them from uploading files list: ${filename}`,
  sameFilenamesError: (filename: string) =>
    `Files which you trying to upload have same names. Please rename or delete them from uploading files list: ${filename}`,
  restrictedNameChars: ':;,=/{}%&\\"',
  notAllowedFilenameError: (filename: string) =>
    `The symbols ${ExpectedConstants.restrictedNameChars} are not allowed in file name. Please rename or delete them from uploading files list: ${filename}`,
  endDotFilenameError: (filename: string) =>
    `Using a dot at the end of a name is not permitted. Please rename or delete them from uploading files list: ${filename}`,
  allFilesRoot: 'All files',
  copyTableTooltip: (copyType: CopyTableType) =>
    `Copy as ${copyType.toUpperCase()}`,
  charsToEscape: ['\\', '"'],
  maxEntityNameLength: 160,
  selectAllTooltip: 'Select all',
  unselectAllTooltip: 'Unselect all',
  deleteSelectedConversationsTooltip: 'Delete selected conversations',
  deleteSelectedPromptsTooltip: 'Delete selected prompts',
  promptLimitExceededTitle: 'Prompt limit exceeded',
  promptLimitExceededMessage: (
    maxPromptTokens: number,
    enteredTokens: number,
    remainedTokes: number,
  ) =>
    `Prompt limit is ${maxPromptTokens} tokens. You have entered ${enteredTokens} tokens and are trying to select a prompt with more than ${remainedTokes} tokens. 1 token approximately equals to 4 characters.`,
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
  addNewFolder = 'Add new folder',
  upload = 'Upload',
  attachFolders = 'Attach folders',
  attachLink = 'Attach link',
  select = 'Select',
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
  themeUrl: 'api/themes/image',
  defaultIconHost: () => `/${API.themeUrl}/default-model`,
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
  shareListing: '/api/share/listing',
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
  restrictedSemicolonCharFilename: 'restricted;char.jpg',
  restrictedEqualCharFilename: 'restricted=char.jpg',
  fileWithoutExtension: 'withoutExtension',
  plotlyName: 'plotly.json',
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
  ANTHROPIC_CLAUDE_V3_5_SONNET = 'anthropic.claude-v3-5-sonnet',
  ANTHROPIC_CLAUDE_V3_HAIKU = 'anthropic.claude-v3-haiku',
  ANTHROPIC_CLAUDE_V3_OPUS = 'anthropic.claude-v3-opus',
  STABLE_DIFFUSION = 'stability.stable-diffusion-xl',
  IMAGE_GENERATION_005 = 'imagegeneration@005',
  GEMINI_PRO_1_5 = 'gemini-1.5-pro-preview-0409',
  GEMINI_FLASH_1_5 = 'gemini-1.5-flash-001',
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
  dark = 'dark',
  light = 'light',
}

export const toTitleCase = (str: string): string =>
  str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
  );

export enum ResultFolder {
  allureChatReport = 'allure-chat-results',
  allureOverlayReport = 'allure-overlay-results',
  chatHtmlReport = 'chat-html-report',
  overlayHtmlReport = 'overlay-html-report',
  testResults = 'test-results',
}

export enum ScrollState {
  top = 'top',
  middle = 'middle',
  bottom = 'bottom',
}

export const MockedChatApiResponseBodies = {
  simpleTextBody: '{"content":"Response"}\u0000{}\u0000',
  listTextBody: `{"content":"1"}\u0000{"content":"."}\u0000{"content":" Italy"}\u0000{"content":"\\n"}\u0000{"content":"2"}\u0000{"content":"."}\u0000{"content":" Greece"}\u0000{"content":"\\n"}\u0000{"content":"3"}\u0000{"content":"."}\u0000{"content":" Switzerland"}\u0000{"content":"\\n"}\u0000{"content":"4"}\u0000{"content":"."}\u0000{"content":" Australia"}\u0000{"content":"\\n"}\u0000{"content":"5"}\u0000{"content":"."}\u0000{"content":" New"}\u0000{"content":" Zealand"}\u0000{"content":"\\n"}\u0000{"content":"6"}\u0000{"content":"."}\u0000{"content":" Mal"}\u0000{"content":"dives"}\u0000{"content":"\\n"}\u0000{"content":"7"}\u0000{"content":"."}\u0000{"content":" Canada"}\u0000{"content":"\\n"}\u0000{"content":"8"}\u0000{"content":"."}\u0000{"content":" Norway"}\u0000{"content":"\\n"}\u0000{"content":"9"}\u0000{"content":"."}\u0000{"content":" France"}\u0000{"content":"\\n"}\u0000{"content":"10"}\u0000{"content":"."}\u0000{"content":" Spain"}\u0000{"content":"\\n"}\u0000{"content":"11"}\u0000{"content":"."}\u0000{"content":" Iceland"}\u0000{"content":"\\n"}\u0000{"content":"12"}\u0000{"content":"."}\u0000{"content":" Scotland"}\u0000{"content":"\\n"}\u0000{"content":"13"}\u0000{"content":"."}\u0000{"content":" Ireland"}\u0000{"content":"\\n"}\u0000{"content":"14"}\u0000{"content":"."}\u0000{"content":" Japan"}\u0000{"content":"\\n"}\u0000{"content":"15"}\u0000{"content":"."}\u0000{"content":" Thailand"}\u0000{"content":"\\n"}\u0000{"content":"16"}\u0000{"content":"."}\u0000{"content":" Croatia"}\u0000{"content":"\\n"}\u0000{"content":"17"}\u0000{"content":"."}\u0000{"content":" Austria"}\u0000{"content":"\\n"}\u0000{"content":"18"}\u0000{"content":"."}\u0000{"content":" Sweden"}\u0000{"content":"\\n"}\u0000{"content":"19"}\u0000{"content":"."}\u0000{"content":" South"}\u0000{"content":" Africa"}\u0000{"content":"\\n"}\u0000{"content":"20"}\u0000{"content":"."}\u0000{"content":" Brazil"}\u0000{"content":"\\n"}\u0000{"content":"21"}\u0000{"content":"."}\u0000{"content":" United"}\u0000{"content":" States"}\u0000{"content":"\\n"}\u0000{"content":"22"}\u0000{"content":"."}\u0000{"content":" India"}\u0000{"content":"\\n"}\u0000{"content":"23"}\u0000{"content":"."}\u0000{"content":" Costa"}\u0000{"content":" Rica"}\u0000{"content":"\\n"}\u0000{"content":"24"}\u0000{"content":"."}\u0000{"content":" Turkey"}\u0000{"content":"\\n"}\u0000{"content":"25"}\u0000{"content":"."}\u0000{"content":" Morocco"}\u0000{"content":"\\n"}\u0000{"content":"26"}\u0000{"content":"."}\u0000{"content":" Argentina"}\u0000{"content":"\\n"}\u0000{"content":"27"}\u0000{"content":"."}\u0000{"content":" Portugal"}\u0000{"content":"\\n"}\u0000{"content":"28"}\u0000{"content":"."}\u0000{"content":" Vietnam"}\u0000{"content":"\\n"}\u0000{"content":"29"}\u0000{"content":"."}\u0000{"content":" Fiji"}\u0000{"content":"\\n"}\u0000{"content":"30"}\u0000{"content":"."}\u0000{"content":" China"}\u0000{"content":"\\n"}\u0000{"content":"31"}\u0000{"content":"."}\u0000{"content":" Indonesia"}\u0000{"content":"\\n"}\u0000{"content":"32"}\u0000{"content":"."}\u0000{"content":" Mexico"}\u0000{"content":"\\n"}\u0000{"content":"33"}\u0000{"content":"."}\u0000{"content":" Peru"}\u0000{"content":"\\n"}\u0000{"content":"34"}\u0000{"content":"."}\u0000{"content":" Chile"}\u0000{"content":"\\n"}\u0000{"content":"35"}\u0000{"content":"."}\u0000{"content":" Netherlands"}\u0000{"content":"\\n"}\u0000{"content":"36"}\u0000{"content":"."}\u0000{"content":" Belize"}\u0000{"content":"\\n"}\u0000{"content":"37"}\u0000{"content":"."}\u0000{"content":" Sey"}\u0000{"content":"ch"}\u0000{"content":"elles"}\u0000{"content":"\\n"}\u0000{"content":"38"}\u0000{"content":"."}\u0000{"content":" Philippines"}\u0000{"content":"\\n"}\u0000{"content":"39"}\u0000{"content":"."}\u0000{"content":" Denmark"}\u0000{"content":"\\n"}\u0000{"content":"40"}\u0000{"content":"."}\u0000{"content":" Hungary"}\u0000{"content":"\\n"}\u0000{"content":"41"}\u0000{"content":"."}\u0000{"content":" Czech"}\u0000{"content":" Republic"}\u0000{"content":"\\n"}\u0000{"content":"42"}\u0000{"content":"."}\u0000{"content":" Mal"}\u0000{"content":"awi"}\u0000{"content":"\\n"}\u0000{"content":"43"}\u0000{"content":"."}\u0000{"content":" Kenya"}\u0000{"content":"\\n"}\u0000{"content":"44"}\u0000{"content":"."}\u0000{"content":" Jordan"}\u0000{"content":"\\n"}\u0000{"content":"45"}\u0000{"content":"."}\u0000{"content":" Tanzania"}\u0000{"content":"\\n"}\u0000{"content":"46"}\u0000{"content":"."}\u0000{"content":" South"}\u0000{"content":" Korea"}\u0000{"content":"\\n"}\u0000{"content":"47"}\u0000{"content":"."}\u0000{"content":" Sri"}\u0000{"content":" Lanka"}\u0000{"content":"\\n"}\u0000{"content":"48"}\u0000{"content":"."}\u0000{"content":" Cambodia"}\u0000{"content":"\\n"}\u0000{"content":"49"}\u0000{"content":"."}\u0000{"content":" Israel"}\u0000{"content":"\\n"}\u0000{"content":"50"}\u0000{"content":"."}\u0000{"content":" Latvia"}\u0000{}\u0000`,
};

export enum CheckboxState {
  checked = 'checked',
  unchecked = 'unchecked',
  partiallyChecked = 'partiallyChecked',
}
export enum ToggleState {
  on = 'ON',
  off = 'OFF',
}
