/*
 * The DIAL Chat Overlay protocol mapper lives behind its own entry so
 * `./conversation` — imported for ordinary chat behavior such as
 * `useAttachmentUpload` — carries no static import of the optional
 * `@epam/ai-dial-chat-overlay` peer
 * ([issue #8855](https://github.com/epam/ai-dial-chat/issues/8855)).
 */
export * from '../conversation/overlay-messages';
