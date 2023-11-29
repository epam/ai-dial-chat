export enum ExpectedMessages {
  newConversationCreated = 'New conversation is created',
  replayConversationCreated = 'Replay conversation is created',
  conversationNameUpdated = 'Conversation name is updated',
  conversationNameNotUpdated = 'Conversation name is not updated',
  conversationDeleted = 'Conversation is deleted',
  conversationNotDeleted = 'Conversation is not deleted',
  conversationMovedToFolder = 'Conversation is moved to a folder',
  contextMenuOptionsValid = 'Context menu options are valid',
  conversationIsVisible = 'Conversation is visible in chat bar',
  conversationIsNotVisible = 'Conversation is not visible in chat bar',
  conversationsCountIsValid = 'Conversation4s count is valid',
  folderIsVisible = 'Folder is visible in chat bar',
  newFolderCreated = 'New folder is created',
  folderCollapsed = 'Folder is collapsed',
  folderExpanded = 'Folder is expanded',
  folderNameUpdated = 'Folder name is updated',
  folderNameNotUpdated = 'Folder name is not updated',
  folderDeleted = 'Folder is deleted',
  folderNotDeleted = 'Folder is not deleted',
  folderConversationDeleted = 'Conversation inside folder is deleted',
  foldersCountIsValid = 'Folders count is valid',
  defaultTalkToIsValid = 'Default Talk to is GPT-3.5',
  talkToEntityIsSelected = 'Talk to entity is selected',
  defaultAssistantModelIsValid = 'Default Assistant model to is GPT-4',
  assistantModelsValid = 'Assistant models are valid',
  modelSelectorNotVisible = 'Model selector is not visible',
  defaultSystemPromptIsEmpty = 'Default System Prompt is empty',
  systemPromptValid = 'System Prompt is valid',
  systemPromptNotVisible = 'System Prompt is not visible',
  defaultTemperatureIsOne = 'Default Temperature is 1',
  temperatureIsValid = 'Set Temperature is preserved',
  temperatureSliderVisible = 'Temperature slider is visible',
  temperatureSliderNotVisible = 'Temperature slider is not visible',
  noAddonsSelected = 'No addon selected',
  selectedAddonsValid = 'Selected addons valid',
  addonsNotVisible = 'Addons are not visible',
  cannotDeleteSelectedAddon = 'Selected addon cannot be deleted',
  recentAddonsVisible = 'Recent addons are visible',
  recentEntitiesVisible = 'Recent entities are visible',
  recentEntitiesIsOnTop = 'Recent entity is on top of the list',
  systemPromptIsValid = 'Set System Prompt is preserved',
  conversationRenamed = 'Conversation is renamed',
  conversationOfToday = 'Conversation is from Today',
  conversationOfYesterday = 'Conversation is from Yesterday',
  conversationOfLastWeek = 'Conversation is from Last 7 days',
  conversationOfLastMonth = 'Conversation is from Last month',
  newPromptCreated = 'New prompt is created',
  promptDeleted = 'Prompt is deleted',
  promptNotDeleted = 'Prompt is not deleted',
  promptModalClosed = 'Prompt modal dialog is closed',
  promptNotUpdated = 'Prompt is not updated',
  promptNameValid = 'Prompt name is valid',
  promptDescriptionValid = 'Prompt description is valid',
  promptVariablePlaceholderValid = 'Prompt variable placeholder is valid',
  promptNameUpdated = 'Prompt name is updated',
  promptDescriptionUpdated = 'Prompt description is updated',
  promptValueUpdated = 'Prompt value is updated',
  promptMovedToFolder = 'Prompt is moved to a folder',
  promptIsVisible = 'Prompt is visible',
  noPromptsImported = 'No prompts are imported',
  deleteAllPromptsButtonNotVisible = 'Delete All Prompts button is not visible',
  promptApplied = 'Prompt is applied to the field',
  promptsCountIsValid = 'Prompts count is valid',
  infoAppIsValid = 'More info application is valid',
  infoAppDescriptionIsValid = 'More info application description is valid',
  entityHasDescription = 'Entity has description',
  entityDescriptionHasFullWidth = 'Entity description has full width',
  descriptionLinkIsBlue = 'Description link color is blue',
  descriptionLinkOpened = 'Description link is opened in a new window',
  startReplayVisible = 'Start Replay button is visible',
  startReplayNotVisible = 'Start Replay button is not visible',
  chatRequestModelIsValid = 'Chat API request model is valid',
  chatRequestModelAssistantIsValid = 'Chat API request assistant model is valid',
  chatRequestPromptIsValid = 'Chat API request prompt is valid',
  chatRequestTemperatureIsValid = 'Chat API request temperature is valid',
  chatRequestAddonsAreValid = 'Chat API request addons are valid',
  chatRequestMessageIsValid = 'Chat API request message is valid',
  sendMessageButtonDisabled = 'Send message button is disabled',
  sendMessageButtonEnabled = 'Send message button is enabled',
  tooltipContentIsValid = 'Tooltip content is valid',
  headerTitleCorrespondRequest = 'Chat header title correspond sent request',
  headerIconsCountIsValid = 'Chat header icons number is valid',
  headerCleanConversationIconVisible = 'Chat header Clean Conversation icon is visible',
  headerIconEntityIsValid = 'Chat header icon entity is valid',
  headerIconSourceIsValid = 'Chat header icon source is valid',
  chatInfoModelIsValid = 'Chat info model is valid',
  chatInfoModelIconIsValid = 'Chat info model icon is valid',
  chatInfoAppIsValid = 'Chat info application is valid',
  chatInfoAppIconIsValid = 'Chat info application icon is valid',
  chatInfoAssistantIsValid = 'Chat info assistant is valid',
  chatInfoAssistantModelIsValid = 'Chat info assistant model is valid',
  chatInfoAssistantModelIconIsValid = 'Chat info assistant model icon is valid',
  chatInfoAssistantIconIsValid = 'Chat info assistant icon is valid',
  chatInfoTemperatureIsValid = 'Chat info temperature is valid',
  chatInfoPromptIsValid = 'Chat info prompt is valid',
  chatInfoAddonIsValid = 'Chat info addon is valid',
  chatInfoAddonIconIsValid = 'Chat info addon icon is valid',
  chatInfoAddonsCountIsValid = 'Chat info addons number is valid',
  proceedReplayIsVisible = 'Proceed replay button is visible',
  replayContinuesFromReceivedContent = 'Replay continued from received content',
  replayRegeneratesStages = 'Replay regenerates all stages',
  allStagesRegenerated = 'All stages are regenerated on Regenerate Response button click',
  errorReceivedOnReplay = 'Error message is received during chat replay',
  compareModeOpened = 'Compare mode is opened',
  compareModeClosed = 'Compare mode is closed',
  conversationToCompareVisible = 'Conversation to compare selector is visible',
  conversationsToCompareOptionsValid = 'Conversation to compare options are valid',
  noConversationsAvailable = 'No conversations are available for comparison',
  responseReceivedForComparedConversations = 'Response is received by both conversations in compare mode',
  requestModeIdIsValid = 'Request modelId is valid in API request',
  requestPromptIsValid = 'Request prompt is valid in API request',
  requestTempIsValid = 'Request temperature is valid in API request',
  requestSelectedAddonsAreValid = 'Request addons are valid in API request',
  requestAssistantModelIdIsValid = 'Request assistant modelId is valid in API request',
  regenerateNotAvailable = 'Regenerate button is not available',
  regenerateIsAvailable = 'Regenerate button is available',
  stopGeneratingAvailable = 'Stop generating button is available',
  chatBarIconEntityIsValid = 'Chat bar icon entity is valid',
  chatBarIconSourceIsValid = 'Chat bar icon source is valid',
  chatBarConversationIconIsDefault = 'Chat bar conversation icon is default',
  chatBarConversationIconIsPlayback = 'Chat bar conversation icon is Playback',
  responseLoadingStopped = 'Conversation response stopped',
  responseIsNotLoading = 'Conversation response not loading',
  responseIsLoading = 'Conversation response is loading',
  onlyLastResponseIsRegenerating = 'Only last chat response is regenerating',
  onlyFirstStageDisplayed = 'Only first stage is displayed in response',
  editModeIsClosed = 'Edit request mode is closed',
  saveIsDisabled = 'Save button is disabled',
  messageCountIsCorrect = 'Chat messages count is correct',
  messageContentIsValid = 'Message content is correct',
  requestMessageIsEdited = 'Request message is edited',
  messageIsDeleted = 'Message is deleted from conversation',
  chatHeaderTitleTruncated = 'Chat header title is truncated',
  conversationSettingsVisible = 'Conversation Settings screen is visible',
  replayAsIsLabelIsVisible = 'Replay As Is label is visible',
  replayAsOptionNotVisible = 'Replay As Is option is not visible',
  chatIconEntityIsValid = 'Chat icon entity is valid',
  chatIconSourceIsValid = 'Chat icon source is valid',
  entitiesIconsCountIsValid = 'Entities icons number is valid',
  entityIconIsValid = 'Entity icon is valid',
  entityIconSourceIsValid = 'Entity icon source is valid',
  addonsIconsCountIsValid = 'Addons icons number is valid',
  addonIconIsValid = 'Addon icon is valid',
  addonIconSourceIsValid = 'Addon icon source is valid',
  draggableAreaColorIsValid = 'Draggable area background color is valid',
  folderNameColorIsValid = 'Folder name color is valid',
  confirmationMessageIsValid = 'Confirmation dialog message is valid',
  chronologyMessageCountIsCorrect = 'Chat bar chronology messages count is correct',
  newPromptButtonIsHighlighted = 'New prompt button is highlighted',
  newPromptButtonCursorIsPointer = 'New prompt button cursor is a pointer',
  appNameIsValid = 'Application name is correct',
  playbackNextButtonEnabled = 'PlayBack next button is enabled',
  playbackNextButtonDisabled = 'PlayBack next button is disabled',
  playbackPreviousButtonDisabled = 'PlayBack previous button is disabled',
  playbackPreviousButtonEnabled = 'PlayBack previous button is enabled',
  playbackChatMessageIsValid = 'Playback chat message is correct',
  playbackMessageIsInViewport = 'Playback message is in viewport',
  playbackNextMessageIsScrollable = 'Playback next message is scrollable',
  playbackNextMessageIsHidden = 'Playback next message is hidden',
  searchResultCountIsValid = 'Search results count is valid',
  noResultsFound = 'No results found is displayed',
  footerIsVisible = 'Footer is visible',
  notAllowedModelErrorDisplayed = 'Not allowed model selected error is displayed',
  replayAsIsDescriptionIsVisible = 'Replay as is description is visible',
  replayOldVersionWarningIsVisible = 'Replay old version of DIAL conversation warning is displayed',
  warningLabelColorIsValid = 'Warning label color is valid',
}
