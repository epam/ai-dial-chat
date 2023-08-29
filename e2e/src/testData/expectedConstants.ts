export const ExpectedConstants = {
  newConversationTitle: 'New conversation',
  newPromptTitle: (index: number) => `Prompt ${index}`,
  newFolderTitle: 'New folder',
  emptyString: '',
  defaultTemperature: '1',
  signInButtonTitle: 'Sign in with Credentials',
  talkTo: 'Talk to',
  model: 'Model',
};

export enum Groups {
  models = 'MODELS',
  assistants = 'ASSISTANTS',
  applications = 'APPLICATIONS',
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
