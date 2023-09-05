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
  anthropicCloudV2Model: 'Anthropic (Claude V2)',
  dollyModel: 'Dolly',
  llama2: 'Llama2',
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
