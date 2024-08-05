export const errorsMessages = {
  generalClient:
    'Error happened during answering. Please check your internet connection and try again.',
  generalServer:
    'Sorry, we were unable to process your request at this time due to a server error. Please try again later. Thank you for your patience and understanding.',
  429: 'Due to high demand our AI capacities are overloaded. We understand the problem and continuously searching for the way to extend capacities of the service (unfortunately there limits on cloud providers). Please, try again in a couple of minutes or try another model',
  401: 'Authorization failed. Please reload the page and login again.',
  403: 'Forbidden',
  400: 'Invalid request',
  contentFiltering:
    'The response was filtered due to the prompt triggering Azure OpenAI’s content management policy. Please modify your prompt and retry.',
  unsupportedConversationsDataFormat:
    'Import of conversations failed because of unsupported data format',
  unsupportedPromptsDataFormat:
    'Import of prompts failed because of unsupported data format',
  localStorageQuotaExceeded:
    'Conversation storage capacity exceeded. Please clean up some conversations (prefer ones with media attachments) and try again.',
  timeoutError:
    'Server is taking to long to respond due to either poor internet connection or excessive load. Please check your internet connection and try again. You also may try different model.',
  customThemesConfigNotProvided:
    'The custom config host url not provided. Please recheck application settings',
  errorDuringEntityRequest: (entityType: string) =>
    `Error happened during ${entityType} request. Please try again later.`,
  errorGettingUserBucket:
    'Error happened during getting file user bucket. Please contact your administrator or try to reload the page.',
  noModelsAvailable:
    'You do not have any available models. Please contact your administrator or try to reload the page.',
  importConversationsFailed: 'Import of conversations failed',
  importPromptsFailed: 'Import of prompts failed',
  exportFailed: 'Export failed',
  shareFailed: 'Sharing failed. Please try again later.',
  acceptShareFailed:
    'Accepting sharing invite failed. Please open share link again to being able to see shared resource.',
  acceptShareNotExists:
    'We are sorry, but the link you are trying to access has expired or does not exist.',
  revokeAccessFailed: 'Revoking access failed. Please try again later.',
  discardSharedWithMeFailed:
    'Discarding shared with you resource failed. Please try again later.',
  shareByMeListingFailed:
    'Getting shared by you resources failed. Please reload the page to get them again.',
  shareWithMeListingFailed:
    'Getting shared with you resources failed. Please reload the page to get them again.',
  notValidEntityType:
    'You made a request with an unavailable or nonexistent entity type',

  entityNameInvalid: 'chat.chat_input.name_is_invalid.text',
  entityPathInvalid: 'chat.chat_input.path_is_invalid.text',

  entityNameInvalidExternal: 'The name is invalid',
  entityPathInvalidExternal: 'The parent folder name is invalid',
  publicationFailed: 'Publication failed. Please try again later.',
  publicationsUploadFailed: 'Publications uploading failed.',
  publicationUploadFailed: 'Publication uploading failed.',
  publicationDeletionFailed: 'Publication deletion failed.',
  publishedConversationsUploadFailed:
    'Published conversations uploading failed.',
  publicationApproveFailed: 'Publication approving failed.',
  publicationRejectFailed: 'Publication rejecting failed.',
  publishingByMeItemsUploadingFailed: 'Published by me items uploading failed.',
  rulesUploadingFailed: 'Rules uploading failed.',
};
