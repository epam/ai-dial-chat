export const errorsMessages = {
  generalServer:
    'Sorry, we were unable to process your request at this time due to a server error. Please try again later. Thank you for your patience and understanding.',
  429: 'Due to high demand our AI capacities are overloaded. We understand the problem and continuously searching for the way to extend capacities of the service (unfortunately there limits on cloud providers). Please, try again in a couple of minutes or try another model',
  401: 'Authorization failed. Please reload the page and login again.',
  unsupportedDataFormat: 'Unsupported data format',
  localStorageQuotaExceeded:
    'Conversation storage capacity exceeded. Please clean up some conversations (prefer ones with media attachments) and try again.',
  customThemesConfigNotProvided:
    'The custom config host url not provided. Please recheck application settings',
};
