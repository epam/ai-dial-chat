export const errorsMessages = {
  generalClient:
    'Error happened during answering. Please check your internet connection and try again.',
  generalServer:
    'Sorry, we were unable to process your request at this time due to a server error. Please try again later. Thank you for your patience and understanding.',
  429: 'Due to high demand our AI capacities are overloaded. We understand the problem and continuously searching for the way to extend capacities of the service (unfortunately there limits on cloud providers). Please, try again in a couple of minutes or try another model',
  401: 'Authorization failed. Please reload the page and login again.',
  400: 'Invalid request',
  unsupportedDataFormat: 'Unsupported data format',
  localStorageQuotaExceeded:
    'Conversation storage capacity exceeded. Please clean up some conversations (prefer ones with media attachments) and try again.',
  timeoutError:
    'Server is taking to long to respond due to either poor internet connection or excessive load. Please check your internet connection and try again. You also may try different model.',
  customThemesConfigNotProvided:
    'The custom config host url not provided. Please recheck application settings',
};
