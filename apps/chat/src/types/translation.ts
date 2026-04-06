export enum Translation {
  Common = 'common',
  SideBar = 'sidebar',
  Header = 'header',
  Chat = 'chat',
  Marketplace = 'marketplace',
  PromptBar = 'promptbar',
  Settings = 'settings',
  Markdown = 'markdown',
  Errors = 'errors',
  Files = 'files',
}

export type TranslationOptions = Record<string, unknown> & {
  ns?: Translation;
};
