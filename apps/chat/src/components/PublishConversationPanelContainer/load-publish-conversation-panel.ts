/** Loads the publish panel chunk; shared by its `lazy` wrapper and the row-menu preload, so both reach one module. */
export const loadPublishConversationPanel = () =>
  import('./PublishConversationPanelContainer');

/** Starts loading the publish panel chunk ahead of the click; a failure is left to the `lazy` render to surface. */
export const preloadPublishConversationPanel = (): void => {
  void loadPublishConversationPanel().catch(() => undefined);
};
